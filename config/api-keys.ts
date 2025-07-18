import supabase from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

// Create a service role client for server-side operations
// This bypasses RLS policies for system operations
const createServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn(
      "⚠️  SUPABASE_SERVICE_ROLE_KEY not found, falling back to regular client"
    );
    return supabase;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

interface KeyManager {
  geminiKeys: string[];
  googleKeys: string[];
  currentGeminiIndex: number;
  currentGoogleIndex: number;
  geminiUsageCount: number[];
  googleUsageCount: number[];
}

class ApiKeyManager {
  private static instance: ApiKeyManager;
  private keyManager: KeyManager = {
    geminiKeys: [],
    googleKeys: [],
    currentGeminiIndex: 0,
    currentGoogleIndex: 0,
    geminiUsageCount: [],
    googleUsageCount: [],
  };
  private isInitialized: boolean = false;

  private constructor() {
    // Database-based initialization
  }

  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  // Initialize keys from database using service role client for server-side access
  public async initializeFromDatabase(): Promise<void> {
    try {
      console.log("🔑 Initializing API keys from database...");

      // Use service role client for server-side operations
      const client = createServiceRoleClient();

      const { data, error } = await client
        .from("api_keys")
        .select("keys_json")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("❌ Database error:", error);
        throw error;
      }

      if (data && data.keys_json) {
        this.keyManager.geminiKeys = data.keys_json.gemini_keys || [];
        this.keyManager.googleKeys = data.keys_json.google_keys || [];

        // Initialize usage counters for fair distribution
        this.keyManager.geminiUsageCount = new Array(
          this.keyManager.geminiKeys.length
        ).fill(0);
        this.keyManager.googleUsageCount = new Array(
          this.keyManager.googleKeys.length
        ).fill(0);

        // Reset indices to start fresh
        this.keyManager.currentGeminiIndex = 0;
        this.keyManager.currentGoogleIndex = 0;
      } else {
        console.warn("⚠️  No API keys configuration found in database");
        this.keyManager.geminiKeys = [];
        this.keyManager.googleKeys = [];
        this.keyManager.geminiUsageCount = [];
        this.keyManager.googleUsageCount = [];
      }

      this.isInitialized = true;

      console.log("✅ API Key Manager initialized from database:", {
        geminiKeysCount: this.keyManager.geminiKeys.length,
        googleKeysCount: this.keyManager.googleKeys.length,
        geminiUsageCount: this.keyManager.geminiUsageCount,
        googleUsageCount: this.keyManager.googleUsageCount,
      });

      if (this.keyManager.geminiKeys.length === 0) {
        console.warn("⚠️  No Gemini API keys found in database");
      }
      if (this.keyManager.googleKeys.length === 0) {
        console.warn("⚠️  No Google API keys found in database");
      }
    } catch (error) {
      console.error("❌ Failed to initialize API keys from database:", error);
      this.keyManager = {
        geminiKeys: [],
        googleKeys: [],
        currentGeminiIndex: 0,
        currentGoogleIndex: 0,
        geminiUsageCount: [],
        googleUsageCount: [],
      };
      this.isInitialized = false;
      throw error;
    }
  }

  // Get next Gemini API key with proper round-robin rotation
  public async getNextGeminiKey(): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.geminiKeys.length === 0) {
      throw new Error("No Gemini API keys configured in database");
    }

    // Use round-robin with usage tracking for better distribution
    const key = this.keyManager.geminiKeys[this.keyManager.currentGeminiIndex];

    // Track usage
    this.keyManager.geminiUsageCount[this.keyManager.currentGeminiIndex]++;

    // Move to next key (round-robin)
    this.keyManager.currentGeminiIndex =
      (this.keyManager.currentGeminiIndex + 1) %
      this.keyManager.geminiKeys.length;

    console.log(
      `🔑 Using Gemini key ${
        this.keyManager.currentGeminiIndex === 0
          ? this.keyManager.geminiKeys.length
          : this.keyManager.currentGeminiIndex
      }/${this.keyManager.geminiKeys.length}`,
      `(usage: ${
        this.keyManager.geminiUsageCount[
          this.keyManager.currentGeminiIndex === 0
            ? this.keyManager.geminiKeys.length - 1
            : this.keyManager.currentGeminiIndex - 1
        ]
      })`
    );

    return key;
  }

  // Get next Google API key with proper round-robin rotation
  public async getNextGoogleKey(): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.googleKeys.length === 0) {
      throw new Error("No Google API keys configured in database");
    }

    // Use round-robin with usage tracking for better distribution
    const key = this.keyManager.googleKeys[this.keyManager.currentGoogleIndex];

    // Track usage
    this.keyManager.googleUsageCount[this.keyManager.currentGoogleIndex]++;

    // Move to next key (round-robin)
    this.keyManager.currentGoogleIndex =
      (this.keyManager.currentGoogleIndex + 1) %
      this.keyManager.googleKeys.length;

    console.log(
      `🔑 Using Google key ${
        this.keyManager.currentGoogleIndex === 0
          ? this.keyManager.googleKeys.length
          : this.keyManager.currentGoogleIndex
      }/${this.keyManager.googleKeys.length}`,
      `(usage: ${
        this.keyManager.googleUsageCount[
          this.keyManager.currentGoogleIndex === 0
            ? this.keyManager.googleKeys.length - 1
            : this.keyManager.currentGoogleIndex - 1
        ]
      })`
    );

    return key;
  }

  // Get specific Gemini key by index for parallel processing with proper distribution
  public async getGeminiKeyByIndex(index: number): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.geminiKeys.length === 0) {
      throw new Error("No Gemini API keys configured in database");
    }

    // Ensure we distribute across all keys even with arbitrary indices
    const keyIndex = index % this.keyManager.geminiKeys.length;
    const key = this.keyManager.geminiKeys[keyIndex];

    // Track usage for this specific key
    this.keyManager.geminiUsageCount[keyIndex]++;

    console.log(
      `🔑 Using Gemini key ${keyIndex + 1}/${
        this.keyManager.geminiKeys.length
      }`,
      `(index: ${index}, usage: ${this.keyManager.geminiUsageCount[keyIndex]})`
    );

    return key;
  }

  // Get specific Google key by index for parallel processing with proper distribution
  public async getGoogleKeyByIndex(index: number): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.googleKeys.length === 0) {
      throw new Error("No Google API keys configured in database");
    }

    // Ensure we distribute across all keys even with arbitrary indices
    const keyIndex = index % this.keyManager.googleKeys.length;
    const key = this.keyManager.googleKeys[keyIndex];

    // Track usage for this specific key
    this.keyManager.googleUsageCount[keyIndex]++;

    console.log(
      `🔑 Using Google key ${keyIndex + 1}/${
        this.keyManager.googleKeys.length
      }`,
      `(index: ${index}, usage: ${this.keyManager.googleUsageCount[keyIndex]})`
    );

    return key;
  }

  // Get the least used Gemini key for better load balancing
  public async getLeastUsedGeminiKey(): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.geminiKeys.length === 0) {
      throw new Error("No Gemini API keys configured in database");
    }

    // Find the key with minimum usage
    let minUsage = Math.min(...this.keyManager.geminiUsageCount);
    let leastUsedIndex = this.keyManager.geminiUsageCount.indexOf(minUsage);

    const key = this.keyManager.geminiKeys[leastUsedIndex];
    this.keyManager.geminiUsageCount[leastUsedIndex]++;

    console.log(
      `🔑 Using least used Gemini key ${leastUsedIndex + 1}/${
        this.keyManager.geminiKeys.length
      }`,
      `(usage was: ${minUsage}, now: ${this.keyManager.geminiUsageCount[leastUsedIndex]})`
    );

    return key;
  }

  // Get the least used Google key for better load balancing
  public async getLeastUsedGoogleKey(): Promise<string> {
    if (!this.isInitialized) {
      await this.initializeFromDatabase();
    }

    if (this.keyManager.googleKeys.length === 0) {
      throw new Error("No Google API keys configured in database");
    }

    // Find the key with minimum usage
    let minUsage = Math.min(...this.keyManager.googleUsageCount);
    let leastUsedIndex = this.keyManager.googleUsageCount.indexOf(minUsage);

    const key = this.keyManager.googleKeys[leastUsedIndex];
    this.keyManager.googleUsageCount[leastUsedIndex]++;

    console.log(
      `🔑 Using least used Google key ${leastUsedIndex + 1}/${
        this.keyManager.googleKeys.length
      }`,
      `(usage was: ${minUsage}, now: ${this.keyManager.googleUsageCount[leastUsedIndex]})`
    );

    return key;
  }

  // Get available key counts
  public getGeminiKeyCount(): number {
    return this.keyManager.geminiKeys.length;
  }

  public getGoogleKeyCount(): number {
    return this.keyManager.googleKeys.length;
  }

  // Get usage statistics
  public getUsageStats() {
    return {
      gemini: {
        keys: this.keyManager.geminiKeys.length,
        usage: this.keyManager.geminiUsageCount,
        totalUsage: this.keyManager.geminiUsageCount.reduce((a, b) => a + b, 0),
      },
      google: {
        keys: this.keyManager.googleKeys.length,
        usage: this.keyManager.googleUsageCount,
        totalUsage: this.keyManager.googleUsageCount.reduce((a, b) => a + b, 0),
      },
    };
  }

  // Reset usage counters
  public resetUsageCounters(): void {
    this.keyManager.geminiUsageCount.fill(0);
    this.keyManager.googleUsageCount.fill(0);
    console.log("🔄 Usage counters reset");
  }

  // Force refresh from database
  public async refreshFromDatabase(): Promise<void> {
    this.isInitialized = false;
    await this.initializeFromDatabase();
  }

  // Backward compatibility methods
  public async getNextKey(): Promise<string> {
    return this.getNextGeminiKey();
  }

  public async getKeyByIndex(index: number): Promise<string> {
    return this.getGeminiKeyByIndex(index);
  }

  public getKeyCount(): number {
    return this.getGeminiKeyCount();
  }

  // For backward compatibility with old API
  public async getApiKeyByType(keyType: string): Promise<string> {
    if (keyType === "GOOGLE_API_KEY") {
      return this.getNextGoogleKey();
    } else if (keyType === "GEMINI_API_KEY") {
      return this.getNextGeminiKey();
    } else {
      throw new Error(`Unknown key type: ${keyType}`);
    }
  }
}

export const apiKeyManager = ApiKeyManager.getInstance();

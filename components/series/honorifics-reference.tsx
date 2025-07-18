import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";

export function HonorificsReference() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpen className="h-4 w-4" />
          Honorifics Reference
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Language Honorifics Reference</SheetTitle>
          <SheetDescription>
            A guide to honorifics and relationship terms in Korean, Chinese, and
            Japanese
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="korean" className="mt-6">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="korean">Korean</TabsTrigger>
            <TabsTrigger value="chinese">Chinese</TabsTrigger>
            <TabsTrigger value="japanese">Japanese</TabsTrigger>
          </TabsList>

          <TabsContent value="korean" className="space-y-4">
            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Family and Relationship Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Romanization</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">형</td>
                      <td className="py-2 pr-4">Hyung</td>
                      <td className="py-2">Older brother (used by males)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">오빠</td>
                      <td className="py-2 pr-4">Oppa</td>
                      <td className="py-2">
                        Older brother (used by females, often romantic/friendly)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">누나</td>
                      <td className="py-2 pr-4">Noona</td>
                      <td className="py-2">Older sister (used by males)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">언니</td>
                      <td className="py-2 pr-4">Unnie</td>
                      <td className="py-2">Older sister (used by females)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">동생</td>
                      <td className="py-2 pr-4">Dongsaeng</td>
                      <td className="py-2">Younger sibling (gender-neutral)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">아저씨</td>
                      <td className="py-2 pr-4">Ajeossi</td>
                      <td className="py-2">
                        Middle-aged man (uncle, stranger)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">아줌마</td>
                      <td className="py-2 pr-4">Ajumma</td>
                      <td className="py-2">
                        Middle-aged woman (aunt, older lady)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">어머니/엄마</td>
                      <td className="py-2 pr-4">Eomeoni/Eomma</td>
                      <td className="py-2">Mother/Mom</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">아버지/아빠</td>
                      <td className="py-2 pr-4">Abeoji/Appa</td>
                      <td className="py-2">Father/Dad</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Formal and Social Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Romanization</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">선배</td>
                      <td className="py-2 pr-4">Sunbae</td>
                      <td className="py-2">Senior (in school, job)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">후배</td>
                      <td className="py-2 pr-4">Hoobae</td>
                      <td className="py-2">Junior (in school, job)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">선생님</td>
                      <td className="py-2 pr-4">Seonsaengnim</td>
                      <td className="py-2">Teacher (respectful)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">사부님</td>
                      <td className="py-2 pr-4">Sabunim</td>
                      <td className="py-2">
                        Master (martial arts, formal teacher)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">도련님</td>
                      <td className="py-2 pr-4">Doryeonnim</td>
                      <td className="py-2">Young master (noble families)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">공자님</td>
                      <td className="py-2 pr-4">Gongjanim</td>
                      <td className="py-2">Noble son (archaic, respectful)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chinese" className="space-y-4">
            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Family Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Pinyin</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">哥哥</td>
                      <td className="py-2 pr-4">Gēge</td>
                      <td className="py-2">Older brother</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">姐姐</td>
                      <td className="py-2 pr-4">Jiějie</td>
                      <td className="py-2">Older sister</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">弟弟</td>
                      <td className="py-2 pr-4">Dìdi</td>
                      <td className="py-2">Younger brother</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">妹妹</td>
                      <td className="py-2 pr-4">Mèimei</td>
                      <td className="py-2">Younger sister</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">阿姨</td>
                      <td className="py-2 pr-4">Āyí</td>
                      <td className="py-2">Aunt / older woman</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">叔叔</td>
                      <td className="py-2 pr-4">Shūshu</td>
                      <td className="py-2">Uncle / older man</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">爸爸</td>
                      <td className="py-2 pr-4">Bàba</td>
                      <td className="py-2">Dad</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">妈妈</td>
                      <td className="py-2 pr-4">Māma</td>
                      <td className="py-2">Mom</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Formal and Social Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Pinyin</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">先生</td>
                      <td className="py-2 pr-4">Xiānsheng</td>
                      <td className="py-2">Mr. / Sir</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">小姐</td>
                      <td className="py-2 pr-4">Xiǎojiě</td>
                      <td className="py-2">
                        Miss (caution: can have double meaning)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">师傅/师父</td>
                      <td className="py-2 pr-4">Shīfu</td>
                      <td className="py-2">
                        Master (skills, martial arts, teacher)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">老师</td>
                      <td className="py-2 pr-4">Lǎoshī</td>
                      <td className="py-2">Teacher</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">公子</td>
                      <td className="py-2 pr-4">Gōngzǐ</td>
                      <td className="py-2">Young master (noble/wealthy)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">大哥</td>
                      <td className="py-2 pr-4">Dàgē</td>
                      <td className="py-2">Big bro (gangster, boss, leader)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">大姐</td>
                      <td className="py-2 pr-4">Dàjiě</td>
                      <td className="py-2">Big sister (respectful)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">少爷</td>
                      <td className="py-2 pr-4">Shàoye</td>
                      <td className="py-2">Young lord/master</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="japanese" className="space-y-4">
            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Family Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Romanization</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">兄/お兄ちゃん</td>
                      <td className="py-2 pr-4">Oniichan</td>
                      <td className="py-2">
                        Older brother (formal / affectionate)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">姉/お姉ちゃん</td>
                      <td className="py-2 pr-4">Oneechan</td>
                      <td className="py-2">
                        Older sister (formal / affectionate)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">弟</td>
                      <td className="py-2 pr-4">Otouto</td>
                      <td className="py-2">Younger brother</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">妹</td>
                      <td className="py-2 pr-4">Imouto</td>
                      <td className="py-2">Younger sister</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">お父さん</td>
                      <td className="py-2 pr-4">Otousan</td>
                      <td className="py-2">Father</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">お母さん</td>
                      <td className="py-2 pr-4">Okaasan</td>
                      <td className="py-2">Mother</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">おじさん</td>
                      <td className="py-2 pr-4">Ojisan</td>
                      <td className="py-2">Uncle / older man</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">おばさん</td>
                      <td className="py-2 pr-4">Obasan</td>
                      <td className="py-2">Aunt / older woman</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="bg-muted px-4 py-2 rounded-t-md">
                <h3 className="font-medium">Formal and Social Terms</h3>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-2 pr-4">Term</th>
                      <th className="text-left pb-2 pr-4">Romanization</th>
                      <th className="text-left pb-2">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4 font-medium">先生</td>
                      <td className="py-2 pr-4">Sensei</td>
                      <td className="py-2">Teacher / expert / doctor</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">師匠</td>
                      <td className="py-2 pr-4">Shishou</td>
                      <td className="py-2">Master (martial arts)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">先輩</td>
                      <td className="py-2 pr-4">Senpai</td>
                      <td className="py-2">Senior (in hierarchy)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">後輩</td>
                      <td className="py-2 pr-4">Kouhai</td>
                      <td className="py-2">Junior (in hierarchy)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">若</td>
                      <td className="py-2 pr-4">Waka</td>
                      <td className="py-2">
                        Young master (often yakuza slang)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">姫</td>
                      <td className="py-2 pr-4">Hime</td>
                      <td className="py-2">Princess / noblewoman</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">お嬢様</td>
                      <td className="py-2 pr-4">Ojousama</td>
                      <td className="py-2">Young lady</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium">殿</td>
                      <td className="py-2 pr-4">Tono</td>
                      <td className="py-2">Lord (archaic, respectful)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium mb-2">Translation Best Practices</h3>
          <ul className="text-sm space-y-2">
            <li>
              • Never translate honorifics directly to English (e.g., don't
              translate "Oppa" as "older brother")
            </li>
            <li>
              • Preserve the original honorific to maintain cultural context
            </li>
            <li>
              • Use the glossary to ensure consistent application of honorifics
            </li>
            <li>
              • Consider the relationship between characters when using
              honorifics
            </li>
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* 英単語の 日本語の いみ（高学年＝5・6年で 出る 136語ぶん）。

   えいごは いままで「イラストを 見せて → 英語で なんと言う？」の 形だけだった。
   ここに いみを 持たせることで、逆向き「英単語を 読んで → 日本語で？」も 出せるようにする。
   出すのは 半々（EIGO_WORD_RATE）。

   いみは 4たくの 選たく肢として ならぶので、同じ いみが 2つ あっては いけない
   （テストで たしかめている）。
   低学年（1〜3年）の えいごは ヒントに「日本語で「りんご」」が 入っていて
   こたえが そのまま 出てしまうので、ここには 入れない（えいごは 5年からなので 出番もない）。 */
export const EIGO_IMI: Record<string, string> = {
  /* もの・くらし */
  key: 'かぎ', cup: 'コップ', letter: 'てがみ', calendar: 'カレンダー', scissors: 'はさみ',
  telescope: 'ぼうえんきょう', compass: 'コンパス', globe: 'ちきゅうぎ', candle: 'ろうそく',
  watch: 'うでどけい', stamp: 'きって', ticket: 'きっぷ', map: 'ちず', flag: 'はた',
  bridge: 'はし', gear: 'はぐるま',

  /* しぜん */
  cloud: 'くも', flower: 'はな', rain: 'あめ', snow: 'ゆき', rainbow: 'にじ',
  mountain: 'やま', river: 'かわ', island: 'しま', forest: 'もり', desert: 'さばく',
  volcano: 'かざん', ocean: 'おおきな海', lake: 'みずうみ', valley: 'たに', cave: 'どうくつ',
  waterfall: 'たき', iceberg: 'ひょうざん', cliff: 'がけ', hill: 'おか',
  coral: 'サンゴ', cactus: 'サボテン', bamboo: 'たけ', mushroom: 'きのこ', sunflower: 'ひまわり',

  /* からだ・たべもの */
  heart: 'しんぞう', skeleton: 'がいこつ',
  egg: 'たまご', carrot: 'にんじん', pumpkin: 'かぼちゃ', sushi: 'すし', ramen: 'ラーメン',
  curry: 'カレー', pancake: 'パンケーキ', doughnut: 'ドーナツ', popcorn: 'ポップコーン',
  honey: 'はちみつ', cheese: 'チーズ', butter: 'バター',

  /* のりもの */
  train: 'でんしゃ',

  /* ばしょ・たてもの */
  kitchen: 'だいどころ', library: 'としょかん', hospital: 'びょういん', station: 'えき',
  airport: 'くうこう', castle: 'しろ', museum: 'はくぶつかん', stadium: 'きょうぎじょう',
  temple: 'おてら', shrine: 'じんじゃ', factory: 'こうじょう', farm: 'のうじょう',
  market: 'いちば', bakery: 'パンや', restaurant: 'レストラン', hotel: 'ホテル',
  zoo: 'どうぶつえん', aquarium: 'すいぞくかん', theater: 'げきじょう', tower: 'とう',
  lighthouse: 'とうだい', harbor: 'みなと', tunnel: 'トンネル',

  /* しごと */
  doctor: 'いしゃ', nurse: 'かんごし', teacher: 'せんせい', chef: 'りょうりにん',
  pilot: 'パイロット', farmer: 'のうか', singer: 'かしゅ', dancer: 'ダンサー',
  artist: 'がか', scientist: 'かがくしゃ', astronaut: 'うちゅうひこうし', firefighter: 'しょうぼうし',

  /* うちゅう・りか */
  planet: 'わくせい', comet: 'すいせい', satellite: 'じんこうえいせい',
  microscope: 'けんびきょう', magnet: 'じしゃく', battery: 'でんち', thermometer: 'おんどけい',
  magnifier: 'むしめがね', testtube: 'しけんかん', fossil: 'かせき',

  /* 生きもの */
  bird: 'とり', dinosaur: 'きょうりゅう', penguin: 'ペンギン', camel: 'ラクダ',
  dolphin: 'イルカ', whale: 'クジラ', shark: 'サメ', octopus: 'タコ', crab: 'カニ',
  butterfly: 'チョウ', spider: 'クモ', ant: 'アリ', bee: 'ハチ', snail: 'カタツムリ',
  squirrel: 'リス', hedgehog: 'ハリネズミ',

  /* どうぐ */
  hammer: 'かなづち', screwdriver: 'ドライバー', wrench: 'スパナ', ladder: 'はしご',
  bucket: 'バケツ', rope: 'つな', anchor: 'いかり', lantern: 'ランタン',

  /* がっき・スポーツ */
  violin: 'バイオリン', trumpet: 'トランペット', flute: 'フルート', harp: 'ハープ',
  trophy: 'トロフィー', medal: 'メダル', whistle: 'ホイッスル', racket: 'ラケット',
  helmet: 'ヘルメット', glove: 'てぶくろ', skateboard: 'スケートボード',

  /* かたち */
  triangle: 'さんかく',
};

/* data/texts の 型つき 再エクスポート（data 側は生成物で @ts-nocheck のため ここで型を付ける） */
import * as T from '../data/texts';
import { MATH_TIPS } from '../data/questions';

export const CONFIG = T.CONFIG as { schoolName: string; eventName: string; promoText: string };
export const GEO_TIPS = T.GEO_TIPS as string[];
export const GEO_TIPS_NAME = T.GEO_TIPS_NAME as string;
export const NC_TIPS = T.NC_TIPS as string[];
export const MATH_TIPS_T = MATH_TIPS as string[];

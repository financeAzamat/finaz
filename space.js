/* ============================================================
   Hero — a rotating dotted Earth, endlessly cycling to numbers.
   ------------------------------------------------------------
   There is no opening sequence. The globe is there on frame 1,
   turning, and the only thing that ever changes is whether its
   land dots read as dots or as 1s and 0s:

     EARTH in dots  →  1 0 1  →  dots  →  ... forever

   2026-08-09, client's final call: "start directly from Earth
   rotation - in dots and then transition to numbers and back -
   endless loop. Remove stars." The star field, the assembly
   morph, Polaris and the whole stars-to-Earth transition are
   gone from this project.

   That transition was signed off and is worth reusing, so it is
   kept as a working reference implementation at
     ~/.claude/skills/design/particle-morph-hero/
   Go there rather than reconstructing it from this file.

   Two things carry the effect, and both are restrictions:

     LAND ONLY   the ocean dots stay dots through the pulse. If
                 the whole sphere turns to digits the continents
                 vanish and it reads as a ball of text; the ocean
                 holding its shape is what keeps it an Earth.
     NEAR SIDE   only dots facing the camera become digits. On
                 the far limb they would be back-to-front and
                 read as noise on the edge.

   The digits are a RENDER MODE, not geometry. A particle painted
   as a "1" is the same particle that was a coastline dot a second
   earlier and will be one again — which is why nothing jumps when
   the pulse ends.

   What a real-time canvas cannot honour, so nobody later mistakes
   an omission for a bug: photoreal 4K Earth textures and
   volumetric dust are renders, not frames a browser paints 60
   times a second. Earth is carried instead by real coastlines,
   limb haze, and a land/ocean split that reads on three channels
   at once (alpha, radius, hue).

   Continents come from country polygons (world.geo.json),
   point-in-polygon sampled offline onto a Fibonacci sphere. Land
   points are listed first, oceans after, so the split is a stride
   through the packed set. 0.70 of the on-globe budget is land
   against a real ~0.29: deliberate, and the reason the continents
   are recognisable at 1200 dots.

   Cost fence: canvas is hero-only; IntersectionObserver stops the
   loop off-screen; prefers-reduced-motion paints one static frame
   of the plain globe. Glyphs and halos are pre-rendered sprites
   blitted with drawImage — a per-particle fillText or gradient
   would cost more than every dot in the frame combined.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const QUIET = canvas.dataset.mode === 'quiet';

  /* ---- palette: the brief's, and nothing neon ---- */
  const COOL  = [186, 214, 255];   // blue-white starlight
  const WARM  = [255, 228, 196];   // warm white
  const CYAN  = [138, 224, 244];   // soft cyan, the accent
  const GOLD  = [255, 196, 116];   // city lights, used sparingly
  const OCEAN = [ 84, 132, 196];
  const LAND  = [196, 228, 255];

  const TAU = 6.283185307, RAD = 0.017453293;
  const PD  = 6.0;   // camera distance. With a ~3.6 model shell this never
                     // divides by near-zero, so no stars pop at the edges.

  /* ---- real geography, packed as tenths of a degree ---- */
  const LAND_N = 1700;
  const GEO = '829,-773,825,-248,818,-573,811,-897,808,-372,793,-496,788,-821,785,-295,782,230,781,-620,776,-945,773,-419,767,-219,762,-543,756,-343,755,1032,747,-467,746,908,741,-266,734,-915,732,-390,731,985,731,-1240,726,1186,724,-514,723,861,720,-839,720,536,719,-313,718,1062,717,-1163,715,737,713,1262,713,-963,711,-437,710,938,708,1463,708,-762,706,-237,706,1138,705,-1087,704,288,703,814,701,1339,699,-361,698,1014,697,1540,696,-685,696,690,695,-1535,694,1215,692,1740,692,-485,691,890,691,-1335,690,1416,688,-1659,687,-284,687,1091,686,-1134,686,241,685,1616,684,766,683,1292,682,-933,682,442,681,-1783,681,-408,680,967,680,-1258,679,1492,678,642,677,-1583,676,1168,676,-1057,675,318,675,1693,674,-532,674,843,673,-1382,672,1368,672,-857,671,518,670,1044,669,-1181,669,194,668,1569,668,-656,667,-1506,666,1244,665,-981,665,394,664,1769,664,-456,663,920,663,-1305,662,1445,661,595,661,-1630,660,1120,659,-1105,659,270,658,1645,657,796,657,-1429,656,1321,655,-904,655,471,655,-1754,654,996,653,-1229,653,146,652,1521,652,-703,651,672,651,-1553,650,-178,650,1197,650,-1028,649,347,649,1722,648,-503,648,872,647,-1353,646,1397,646,-827,644,1073,644,-1152,643,1598,642,748,642,-1477,641,1273,640,-951,640,424,639,-426,639,949,638,-1276,638,99,637,1474,636,624,636,-1601,635,1149,635,-1075,634,300,634,1675,633,825,633,-1400,632,1350,631,500,630,1025,629,-1199,629,176,628,1551,628,-674,627,701,627,-1524,626,1226,626,-999,625,376,625,1751,625,-474,624,901,624,-1323,623,1427,622,-798,622,577,622,-1648,621,1102,620,-1123,620,252,620,1627,619,777,618,-1447,618,1303,617,453,616,978,615,-1247,615,128,614,1503,614,-722,614,653,613,-1571,612,1179,612,-1046,612,329,611,1704,610,854,610,-1371,609,1379,607,1055,607,-1170,605,730,605,-1495,604,1255,604,-970,603,406,603,-444,602,931,602,-1294,601,81,601,1456,601,-769,600,606,600,-1619,599,1131,599,-1094,597,807,596,1332,595,482,594,1007,594,-1218,594,158,593,1533,592,683,592,-1542,591,1208,591,-1017,591,358,589,883,589,-1342,588,1409,588,559,586,1084,586,-1141,585,1609,585,759,584,1285,583,-940,583,435,582,960,581,-1265,580,-740,580,635,579,1161,578,-1064,578,311,577,836,576,1361,575,511,574,1037,574,-1188,573,187,573,-663,572,712,571,1237,571,-988,571,387,570,913,569,-1312,568,588,567,1113,566,-1112,565,789,564,1314,564,-911,563,464,562,989,562,-1236,562,139,561,-710,561,665,560,1190,559,-1035,559,340,558,865,556,541,555,1066,555,-1159,555,216,554,1591,554,-634,553,741,552,1267,552,-958,552,417,551,942,550,-1283,550,92,549,-758,549,617,548,1143,548,-1082,547,293,547,818,546,-32,546,1343,545,-882,545,493,544,1019,544,-1206,543,169,543,-681,542,694,541,1219,541,-1006,541,369,540,895,539,-1330,538,570,537,1095,537,-1130,536,245,536,-605,535,771,535,-79,534,1296,534,-929,534,446,533,971,533,-1254,532,121,532,-728,531,647,530,1172,530,-1053,529,847,528,-3,528,1372,527,-852,527,523,526,1048,526,-1177,526,198,525,1573,525,-652,525,723,524,1248,523,-976,523,399,522,924,522,74,521,-776,521,599,520,1124,519,-1100,519,275,518,-575,518,800,517,-50,517,1325,517,-900,517,475,516,1000,515,-1224,515,151,514,-699,514,676,513,1201,513,-1024,513,351,512,876,511,27,511,1402,510,-823,510,552,509,1077,509,-1148,509,227,508,-623,508,752,507,1278,507,-947,506,428,505,953,505,-1272,505,103,504,-747,504,628,503,1154,503,-1071,502,304,501,829,501,1354,500,-871,500,505,499,1030,499,-1195,498,180,498,705,497,1230,496,-995,496,381,495,906,495,56,494,1431,494,-794,494,581,493,1106,493,-1119,492,257,491,782,491,1307,490,-918,490,457,489,982,489,-1243,488,133,488,-717,488,658,487,1183,486,-1042,486,333,485,858,485,9,484,1384,484,-841,484,534,483,1059,483,-1166,482,209,482,734,481,1260,480,-965,480,410,479,935,479,85,478,-765,478,610,477,1136,477,-1089,476,286,476,811,475,1336,474,-889,474,486,473,1012,473,-1213,473,162,472,-688,472,687,471,1212,471,-1013,471,362,470,888,469,38,469,-812,468,563,467,1088,467,-1137,467,238,466,764,465,-936,465,439,464,964,463,114,463,-735,462,640,462,1165,461,-1060,460,840,460,-10,459,1366,459,-859,458,1041,458,-1184,457,191,457,-659,457,716,456,1242,456,-983,455,392,454,917,454,67,453,-783,453,592,452,1118,452,-1107,452,268,451,793,450,1318,450,-907,450,468,449,994,449,-1231,448,-706,447,669,447,1194,446,-1031,446,344,445,870,445,20,444,-830,444,545,443,1070,443,-1155,443,220,442,746,441,1271,441,-954,440,421,440,946,439,-753,438,622,438,1147,437,-1078,436,822,435,1347,435,-877,434,1023,434,-1202,434,173,433,698,432,1223,432,-1001,430,1424,430,-801,429,574,429,1099,428,-1125,428,250,427,775,427,-75,427,1300,426,-925,426,450,425,975,425,126,424,-724,424,651,423,1176,423,-1049,422,851,421,2,421,-848,421,527,420,1052,420,-1173,419,202,419,727,418,1253,418,-972,417,928,416,-772,415,603,414,1129,414,-1096,414,279,413,804,413,-46,412,-896,412,480,411,1005,411,-1220,411,155,410,680,409,1205,409,-1020,409,356,408,881,407,1406,407,-819,407,556,406,1081,406,-1144,405,232,405,757,404,1282,404,-943,403,432,403,957,402,-742,401,633,401,1158,400,-1067,400,308,399,833,399,-16,397,1034,397,-1191,396,709,395,-990,395,385,394,910,393,-790,393,585,392,1111,392,-1114,391,786,390,-64,390,-914,390,461,389,987,388,662,387,-1038,387,337,386,863,385,-837,384,1063,384,-1162,383,213,383,739,382,1264,382,-961,381,414,381,939,379,615,379,1140,379,-1085,378,290,378,815,377,-35,377,-884,376,491,376,1016,375,-1209,374,691,374,1217,373,-1008,373,367,372,892,372,-808,371,567,371,1093,370,-1132,369,768,369,1293,368,-932,368,443,367,969,366,644,366,1169,365,-1056,365,319,364,845,364,1370,363,-855,363,520,362,1045,362,-1180,361,721,360,396,359,921,359,71,358,-778,358,597,358,1122,357,-1103,356,797,356,-53,355,-902,355,473,354,998,353,673,352,-1026,351,874,351,24,351,1399,350,-826,350,549,350,1074,349,-1150,348,750,348,1275,347,-950,347,425,347,950,346,101,345,626,345,1151,344,-1074,344,826,343,-23,343,1352,343,-873,342,502,342,1027,341,702,340,-997,339,378,339,903,338,53,338,-797,338,578,337,1104,337,-1121,336,779,335,-71,335,1304,335,-921,335,455,334,980,333,655,332,1180,332,-1045,331,856,330,6,330,-844,330,531,329,1056,329,-1169,328,732,327,-968,327,407,326,83,325,608,324,1133,324,-1092,323,808,323,-41,322,-891,322,484,321,1009,320,684,320,1210,319,-1015,319,360,318,885,318,35,318,-815,317,560,317,1086,316,-1139,316,236,316,761,315,-89,315,-939,314,436,314,962,313,112,313,637,312,1162,312,-1063,311,312,311,838,310,-12,310,-862,310,513,309,1038,308,714,307,-986,307,389,306,914,306,64,305,590,304,1115,304,-1110,304,265,303,790,303,-60,302,-909,302,466,301,991,301,141,300,666,300,1192,300,-1033,299,342,299,867,298,17,298,-833,298,542,297,1068,296,218,296,743,295,-957,295,418,294,94,293,619,292,1144,292,-1081,292,294,291,820,291,-30,289,1020,289,170,288,696,287,-1004,287,371,287,896,286,46,285,572,285,1097,284,247,284,772,283,-78,283,448,282,973,282,123,281,648,280,1173,280,-1051,280,324,279,849,279,-1,278,524,277,1049,277,200,276,725,276,-125,276,-975,275,400,275,925,274,76,274,601,273,1126,273,-1099,273,276,272,801,271,-48,271,477,270,1002,270,152,269,677,268,-1022,267,878,267,28,267,-822,266,1079,265,229,265,754,264,-96,264,430,263,955,262,105,262,630,261,1155,261,-1070,261,306,260,831,258,1031,258,182,257,707,257,-143,257,-993,256,382,256,907,255,58,254,1108,254,-1117,254,258,253,783,253,-66,252,459,251,984,251,134,250,1185,249,-1040,249,335,248,860,248,10,247,1061,246,211,246,736,245,-114,245,411,244,937,244,87,242,1137,242,287,241,813,241,-37,240,488,240,1013,239,163,239,689,238,1214,238,-1011,237,889,237,39,236,565,235,1090,235,240,234,765,234,-85,233,441,233,966,232,116,231,-1058,231,317,230,842,229,-8,229,517,228,1043,228,193,227,718,227,-132,226,-982,226,393,226,919,225,69,225,594,224,1119,223,795,222,-55,222,470,221,995,221,145,219,-1029,219,346,219,871,218,21,218,547,217,1072,216,222,216,747,215,-103,215,423,214,948,214,98,212,299,212,824,211,-26,211,-876,211,499,210,1024,210,175,208,-150,208,-1000,207,51,206,576,206,1101,205,251,205,776,204,-73,204,452,203,977,203,127,201,-1047,201,328,200,853,200,3,199,528,199,1054,198,204,198,729,197,-121,197,-971,196,80,194,281,193,806,193,-44,193,-894,192,481,192,1006,191,157,191,-693,190,-1018,190,357,189,33,188,558,187,233,187,758,186,-91,186,434,185,959,184,-741,183,310,182,835,182,-15,181,510,181,1036,180,186,180,-664,179,-139,179,-989,178,62,176,262,176,788,175,-62,175,-912,175,463,174,988,174,138,172,339,171,14,170,540,170,1065,169,215,169,740,168,-110,168,-959,167,91,165,292,165,817,164,-33,164,492,163,1018,163,168,162,-157,161,1218,161,368,160,44,158,244,158,770,157,-80,157,-930,157,445,156,120,154,321,153,-4,153,-853,152,1047,152,197,151,-128,150,398,149,73,147,274,147,799,146,-51,146,-901,146,474,145,999,145,150,143,350,142,26,141,1076,141,226,140,751,138,102,137,303,136,-22,135,-872,134,1029,134,179,133,-146,133,380,132,55,130,256,129,781,129,-69,127,132,126,332,125,8,124,-842,124,1058,123,208,122,-116,122,409,121,84,119,285,118,-40,117,161,115,361,114,37,113,1087,113,237,112,763,112,-87,110,113,110,-736,108,314,108,-11,106,1040,106,190,105,-135,104,391,103,66,102,267,101,792,101,-58,100,467,99,143,99,-707,98,343,97,19,96,-831,95,219,95,-631,94,-105,94,420,93,95,92,-755,91,296,90,-29,90,497,89,172,88,-678,87,373,86,48,86,-802,85,249,84,774,84,-76,83,449,82,125,82,-725,81,325,80,1,78,201,78,-649,77,-123,77,1252,77,402,76,77,75,-773,74,278,73,803,73,-47,72,478,72,1004,72,154,71,-696,70,355,69,30,67,231,67,-619,67,-94,66,431,65,107,65,-743,63,307,62,-17,61,183,61,-667,59,384,58,59,57,260,57,-590,56,-65,55,460,54,136,54,-714,53,1186,53,336,50,212,50,-637,49,413,48,88,48,-761,46,289,46,-561,44,1015,44,165,43,-685,42,366,40,242,39,-608,38,442,38,968,37,118,37,-732,36,1168,36,318,35,-532,33,-656,32,395,29,271,29,-579,27,997,27,147,26,-703,25,348,23,224,22,-626,21,424,20,100,20,-750,19,1150,19,300,18,-550,16,176,16,-674,15,377,13,1103,12,253,12,-597,10,129,9,-721,9,1179,8,330,8,-520,6,206,5,-644,4,406,3,-768,2,1132,2,282,1,-568,0,1008,-1,158,-1,-692,-2,359,-3,-491,-5,235,-5,-615,-7,111,-8,-739,-8,1161,-9,311,-9,-538,-11,1037,-11,187,-12,-662,-13,388,-13,-462,-14,-786,-15,1114,-15,264,-16,-586,-18,140,-18,-710,-19,341,-20,-509,-20,1391,-22,217,-22,-633,-25,-757,-26,293,-26,-557,-27,1344,-28,1019,-28,169,-29,-681,-29,1220,-30,370,-30,-480,-31,1420,-32,246,-33,-604,-33,1296,-34,-403,-35,122,-35,-728,-36,323,-37,-527,-37,1373,-38,1048,-39,199,-39,-651,-41,-451,-42,-775,-43,275,-43,-575,-45,151,-46,-699,-46,1202,-47,352,-47,-498,-48,1402,-49,228,-50,-622,-51,-421,-52,-746,-53,305,-54,-545,-56,181,-56,-669,-57,381,-58,-469,-58,1432,-59,-793,-60,257,-60,-593,-62,-392,-62,133,-63,-717,-64,334,-64,-516,-66,1060,-66,210,-67,-640,-68,-439,-69,1461,-69,-764,-70,286,-71,-563,-72,-363,-73,162,-73,-687,-74,363,-76,1414,-77,1089,-77,239,-77,-611,-79,-410,-80,-735,-81,316,-81,-534,-83,192,-84,-658,-85,-458,-86,-782,-88,268,-88,-582,-89,-381,-90,144,-90,-706,-92,345,-92,-505,-94,221,-95,-629,-96,-428,-97,-753,-98,298,-99,-552,-101,174,-101,-676,-102,374,-103,-476,-105,250,-105,-600,-107,-399,-108,-724,-109,327,-109,-523,-111,203,-112,-647,-113,403,-113,-446,-114,-771,-115,280,-116,-570,-117,1330,-118,156,-118,-694,-120,356,-120,-494,-122,232,-123,-618,-124,-417,-125,-742,-126,309,-127,-541,-127,1359,-129,185,-129,-665,-130,385,-131,-464,-133,261,-133,-588,-134,1312,-135,137,-136,-712,-137,-512,-140,214,-140,-636,-141,1265,-142,-435,-143,-760,-144,291,-144,-559,-145,1341,-145,491,-146,167,-147,-683,-148,367,-148,-483,-149,1418,-150,243,-151,-607,-152,1294,-152,-406,-153,-731,-155,320,-155,-530,-157,196,-158,-654,-158,1246,-159,397,-159,-453,-160,1447,-161,273,-162,-577,-163,1323,-163,473,-164,149,-164,-701,-166,349,-166,-501,-168,225,-169,-625,-169,1276,-170,-424,-172,302,-173,-548,-174,1352,-175,178,-175,-672,-176,1228,-177,-471,-178,1429,-179,255,-180,-595,-180,1305,-181,455,-181,-395,-182,131,-183,331,-184,-519,-185,1382,-186,207,-186,-643,-187,1258,-188,-442,-189,1458,-190,284,-191,1334,-192,484,-193,160,-193,-690,-195,-489,-196,1411,-197,236,-197,-613,-198,1287,-199,-413,-201,313,-202,-537,-203,1364,-204,189,-204,-661,-205,1240,-206,-460,-207,1440,-208,266,-209,-584,-210,1316,-210,466,-211,142,-212,1192,-213,342,-213,-508,-214,1393,-215,218,-216,-632,-216,1269,-217,-431,-218,1469,-220,295,-220,-555,-221,1345,-222,171,-223,-679,-223,1221,-224,-478,-225,1422,-227,248,-227,-602,-228,1298,-228,448,-229,1499,-231,1174,-231,324,-231,-526,-232,1375,-234,200,-234,-650,-235,1251,-237,1451,-238,277,-238,-573,-239,1327,-241,153,-241,-697,-242,1203,-243,-496,-244,1404,-245,230,-246,-620,-248,1481,-249,1156,-250,306,-250,-544,-251,1357,-252,182,-253,-668,-254,1233,-255,1433,-257,259,-257,-591,-258,1309,-260,1510,-261,1185,-262,-514,-262,1386,-264,211,-264,-638,-265,1262,-267,1463,-268,1138,-268,288,-269,-562,-270,1339,-271,164,-272,-686,-273,1215,-273,-485,-274,1415,-276,241,-276,-609,-277,1291,-279,1492,-280,1167,-280,317,-281,-533,-282,1368,-283,193,-284,-657,-284,1244,-286,1444,-288,270,-288,-580,-289,1320,-291,1521,-291,-704,-292,1196,-293,-503,-294,1397,-295,223,-296,-627,-296,1273,-298,1474,-300,299,-300,-551,-301,1350,-303,175,-303,-675,-304,1226,-306,1426,-307,252,-308,-598,-309,1302,-311,1178,-312,-521,-313,1379,-315,205,-315,-645,-316,1255,-318,1456,-320,281,-320,-569,-321,1332,-323,-693,-324,1208,-326,1408,-327,234,-328,-616,-330,1485,-332,1160,-332,-539,-333,1361,-335,186,-335,-663,-336,1237,-338,1438,-340,-587,-343,-711,-344,1190,-346,1390,-348,-634,-351,1467,-356,-682,-358,1744,-359,1419,-361,-605,-364,1496,-364,-729,-369,-652,-372,1449,-374,-576,-377,-700,-382,-623,-391,-670,-392,1755,-399,-718,-404,-641,-413,-688,-415,1737,-422,-736,-427,-659,-436,-707,-438,1719,-451,-677,-460,-725,-462,1701,-475,-695,-485,-743,-501,-713,-528,-732,-546,-702,-663,571,-669,1297,-675,1173,-678,848,-679,1374,-682,1049,-686,1250,-689,925,-690,1450,-691,600,-693,1126,-696,801,-697,1326,-698,476,-700,1002,-702,1527,-702,-698,-703,677,-704,1202,-706,352,-707,878,-709,1403,-710,553,-712,1078,-713,228,-714,1604,-714,-621,-715,754,-716,-96,-717,1279,-718,429,-720,954,-721,105,-722,1480,-723,630,-725,1155,-726,305,-727,1680,-728,830,-729,-19,-730,1356,-731,506,-733,1031,-735,181,-735,1556,-736,-669,-737,706,-738,-143,-739,1232,-739,-993,-740,382,-742,907,-744,57,-744,1432,-745,-793,-746,582,-748,1108,-749,-1117,-749,258,-750,1633,-752,783,-753,-67,-754,1308,-755,-917,-755,458,-758,984,-759,-1241,-759,134,-761,-716,-762,659,-763,-191,-764,1184,-765,-1041,-766,334,-768,860,-769,-1365,-770,10,-771,1385,-772,-840,-772,535,-775,1060,-776,-1165,-777,210,-778,1585,-780,736,-781,-1489,-781,-114,-782,1261,-783,-964,-784,411,-786,-439,-787,936,-788,-1289,-789,86,-790,1461,-792,612,-793,-1613,-794,-238,-795,1137,-796,-1088,-797,287,-801,812,-802,-1413,-803,-38,-804,1338,-805,-887,-806,488,-810,1013,-811,-1212,-812,163,-814,1538,-815,-687,-816,688,-818,-1537,-819,-162,-820,1214,-822,-1011,-823,364,-826,-486,-827,889,-829,-1336,-831,39,-832,1414,-834,-811,-835,564,-839,-286,-841,1090,-843,-1135,-845,240,-847,1615,900,0,864,1050,849,-1499,837,-449,826,-1623,815,-1422,805,-1222,798,-171,791,-1346,783,-1145,774,-1794,768,631,762,832,757,-1718,751,-1517,745,-1317,740,1109,736,-1441,729,1510,725,336,716,1587,710,-1287,702,-1411,697,164,689,566,673,-7,662,-780,645,-1677,637,-751,627,-149,616,-1772,608,-1695,603,1781,597,-43,590,1733,586,234,581,110,577,-1389,572,-1513,568,-1637,563,-1761,558,-510,556,-309,549,-1608,544,-357,539,45,535,-1454,529,1697,523,1774,519,1650,513,-174,508,1602,504,-1596,500,-1720,495,-469,491,-1443,487,-192,482,1584,478,1460,475,-39,470,1738,467,1614,464,-1261,461,-535,456,-1509,453,-1633,449,-1757,446,1719,442,-630,439,96,437,-553,433,1548,431,-476,428,-600,424,-1574,421,1377,418,-122,415,-1621,412,-1745,408,1731,405,1607,402,-1268,400,-542,397,184,395,1760,392,-264,389,-1764,387,-188,385,1388,382,-1486,380,1465,377,-1410,375,-684,372,42,370,-607,367,119,364,-1380,362,-655,359,-1304,357,-578,354,148,352,349,349,225,347,-425,344,301,341,-1198,339,1753,336,254,334,-1245,332,331,329,-319,327,1257,325,-1617,322,1334,320,-691,318,1410,314,-1789,312,-213,309,-337,307,-136,305,-785,303,1316,300,-1559,297,-1683,295,-107,293,-1606,290,-880,289,-680,286,-1329,284,1622,282,-402,280,1699,278,-326,275,1775,273,-249,270,-373,268,1203,266,553,264,-1471,262,1480,260,-1394,258,-1194,256,-468,254,-267,251,-391,250,-190,247,535,246,-1489,243,1462,242,1663,240,-362,238,364,236,-1660,234,1291,232,641,230,-1383,228,1568,225,-1306,223,1644,221,-380,220,-179,218,-828,216,-1478,214,1473,212,1674,210,-1200,208,375,206,-799,204,-1448,202,1502,201,1703,199,-321,197,405,195,605,194,-569,191,1532,189,-493,188,-292,186,1284,184,634,183,-540,181,-1189,179,1761,177,-1638,175,-1437,173,-711,172,1714,170,-1685,168,1266,167,1466,165,-1083,163,-1733,161,-1007,160,-806,158,1619,156,970,155,-204,153,-1379,151,1572,150,1773,148,598,147,-576,145,-700,143,1725,142,551,140,-1473,139,952,137,-222,136,-1397,134,1554,132,1755,131,-1645,129,-1444,128,981,126,-193,125,-1368,123,1583,122,1784,120,609,119,-565,117,-1740,116,-1539,115,887,113,-288,111,-937,110,1489,108,1689,107,515,105,715,104,916,102,-259,101,-908,99,668,97,-507,96,-306,94,1270,93,1470,91,1671,89,-1728,88,-1528,86,-1327,85,-1126,83,-401,81,-200,80,-1374,78,1051,76,1777,75,-1622,73,-1422,71,1529,70,-495,68,-1670,67,-1469,65,-1269,64,-1068,62,-867,61,1558,59,1759,58,584,56,-1440,55,-1239,53,1711,52,-838,50,1588,49,1788,47,-1611,46,-1411,44,-360,43,1216,41,1416,40,-1133,39,-933,37,-1582,35,-6,34,1044,32,1245,31,70,30,1121,28,1321,26,672,25,-502,24,548,22,749,21,-426,19,-225,18,1351,17,-1199,15,-998,13,-798,12,778,11,-1771,9,-1571,7,5,6,1055,5,1256,3,82,2,1657,0,483,-2,-166,-3,34,-4,1085,-6,1285,-7,-1264,-9,1686,-10,512,-12,-1512,-13,-1312,-15,1639,-17,465,-18,665,-20,866,-21,-309,-23,-108,-24,943,-25,-232,-27,-881,-29,695,-31,45,-32,-1129,-34,447,-35,-1578,-37,-1377,-39,-1176,-40,-976,-41,1450,-43,1650,-44,476,-46,-1548,-48,27,-49,-1147,-51,-947,-52,1479,-53,1680,-55,505,-56,706,-58,906,-60,-1118,-61,-917,-63,658,-64,859,-66,-1691,-67,-115,-69,-1289,-70,-1089,-72,-888,-73,688,-75,-1337,-77,-1136,-78,-935,-80,1490,-81,1691,-83,516,-84,717,-85,1767,-87,-1632,-89,-56,-90,-1231,-91,-1030,-93,-830,-94,1596,-96,422,-97,622,-99,823,-100,-1727,-101,-1526,-103,50,-104,1100,-106,1301,-107,126,-109,-1048,-110,-848,-112,1578,-113,1779,-115,-1621,-116,-45,-118,-1220,-119,-1019,-121,-818,-122,1607,-124,433,-125,633,-127,834,-128,-340,-130,-140,-132,1436,-133,-1114,-134,462,-136,663,-138,863,-139,-1686,-140,-1486,-142,-1285,-143,1141,-145,-884,-147,-1533,-149,-1332,-150,1093,-152,-931,-153,1494,-155,1695,-156,521,-158,721,-160,-1303,-161,-1102,-163,-1752,-165,-1551,-166,-1350,-168,-300,-169,-99,-171,101,-172,1152,-174,-873,-175,1553,-177,904,-179,-271,-180,-70,-182,-719,-184,1706,-185,-1693,-187,-1493,-188,-1292,-190,1134,-192,-1741,-194,-1540,-195,886,-196,-289,-198,-88,-200,112,-201,1163,-203,-861,-204,1564,-206,1765,-208,-260,-209,-59,-211,1517,-213,1717,-214,-1682,-216,-1481,-218,-1281,-219,1145,-221,-880,-222,1546,-225,897,-226,-278,-228,-77,-229,124,-231,1699,-233,-1700,-234,-1499,-236,926,-237,-248,-239,-898,-241,1528,-243,1729,-244,-1671,-246,-1470,-247,955,-249,-219,-251,-868,-253,1557,-254,1758,-256,-1642,-258,-1441,-259,985,-261,-190,-262,11,-264,-1164,-266,412,-267,-762,-269,813,-271,1014,-273,-1010,-274,-810,-276,1616,-278,-1784,-279,642,-281,-1382,-283,1043,-285,-981,-286,69,-288,1645,-290,-1754,-291,-1554,-293,-1353,-295,1072,-297,-952,-298,99,-300,-1076,-301,500,-303,700,-305,901,-307,-273,-308,-73,-310,-1247,-312,-1047,-313,-846,-315,1580,-317,1780,-318,606,-320,-1419,-322,1007,-324,-167,-325,-1342,-327,1084,-329,1284,-330,-1265,-332,-1065,-334,-864,-335,1561,-337,-463,-339,-1637,-341,788,-342,-1761,-344,664,-345,-510,-347,-1685,-348,741,-350,1791,-352,-1608,-353,-558,-354,493,-356,1543,-358,369,-359,570,-361,1620,-362,446,-364,646,-366,1697,-367,522,-369,1573,-371,398,-372,-776,-374,274,-375,-900,-377,150,-379,-1024,-380,26,-382,-1148,-383,1277,-385,-1272,-386,-222,-388,829,-389,-1721,-391,705,-393,-470,-394,581,-396,1631,-397,457,-399,1507,-401,333,-402,1383,-404,-1166,-405,1259,-407,-1290,-408,-240,-410,811,-411,-1739,-413,-1538,-415,887,-417,-1662,-418,-612,-420,439,-421,1489,-423,315,-425,1365,-426,-1184,-428,-984,-430,67,-432,1117,-433,-1432,-435,-382,-437,-1556,-438,869,-440,-1680,-442,-630,-443,421,-445,-754,-447,297,-448,1347,-450,-1202,-452,1223,-453,-1326,-455,-276,-457,774,-458,-1775,-461,-1574,-462,851,-464,-1698,-466,-648,-467,402,-469,1453,-471,-1097,-472,-46,-474,1004,-476,-170,-478,-1345,-480,-294,-482,756,-483,-1793,-485,632,-487,1683,-489,-867,-491,184,-492,1234,-494,-1315,-496,1110,-498,-1439,-500,-389,-502,-1563,-504,-513,-505,538,-507,1588,-509,-961,-511,89,-513,-1085,-515,-35,-517,1016,-518,-1534,-520,-484,-522,567,-524,1617,-526,-932,-528,118,-530,-1056,-532,1369,-534,-1180,-536,-130,-538,921,-540,-1629,-542,-578,-544,472,-546,1523,-548,348,-550,-826,-552,224,-555,1275,-557,-1275,-559,-224,-561,826,-563,-1723,-565,-673,-567,377,-569,1428,-571,253,-573,1304,-576,-1246,-578,-195,-580,855,-582,-1694,-584,-644,-586,407,-589,1457,-591,-1092,-594,1333,-596,-1216,-598,-166,-600,885,-603,-1665,-605,-614,-607,436,-610,1486,-612,-1063,-615,1363,-617,-1187,-620,-137,-622,914,-625,-1636,-627,-585,-630,465,-632,1516,-635,-1034,-637,17,-640,-1158,-643,-107,-646,943,-648,-1606,-651,-556,-654,495,-656,1545,-659,-1004,-662,46,-666,247,-669,-928,-672,123,-676,-1052,-680,-851,-684,-651,-687,1775,-692,-249,-697,-49,-703,-1548,-710,-822,-719,-1796,-726,-1070,-734,-1194,-747,-267,-767,1709,-791,-763,-837,-1661,-864,440';
  let GPTS = null;
  function geoPts() {
    if (GPTS) return GPTS;
    const a = GEO.split(',');
    GPTS = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) GPTS[i] = a[i] / 10;
    return GPTS;
  }

  /* ---- the sequence. There is no sequence any more: the hero IS a
         rotating Earth, from the first frame, forever.

         2026-08-09, final shape: "start directly from Earth rotation
         - in dots and then transition to numbers and back - endless
         loop. Remove stars." So the whole star-field opening is gone,
         and with it the assembly morph. The globe is simply there on
         frame 1, turning, and the only thing that ever changes is
         whether its land dots are reading as dots or as 1s and 0s.

         The previous version (stars → digits → Earth, then endless
         rotation) is kept as a reference implementation at
         ~/.claude/skills/design/particle-morph-hero/ — it was signed
         off and is worth reusing, it just is not this project.

         INTRO is now only a fade out of black, 1.2s, and it gates
         nothing: the planet is already rotating underneath it. There
         is no lag by construction, because there is nothing queued
         in front of the motion. ---- */
  const INTRO = 1.2;       // the globe fades up out of black; rotation already running

  /* ---- the code pulse: dots → numbers → dots, endlessly.
         CODE_WAIT  plain-globe beat before the first pulse, so a visitor
                    sees the Earth as an Earth before it starts computing
         CODE_EVERY period from one pulse to the next
         CODE_RUN   length of a single pulse, in and out

         11.0s period with a 4.6s pulse leaves the globe plain for a bit
         under 60% of the time. That ratio is the whole effect: the
         numbers have to be an event the eye catches, not a texture it
         stops seeing. Long enough to read, sparse enough to notice. */
  const CODE_WAIT  = 2.0;
  const CODE_EVERY = 11.0;
  const CODE_RUN   = 4.6;

  /* The case page has no canvas at all now, so QUIET is vestigial —
     kept only so the file stays safe if a canvas is ever added back
     with data-mode="quiet". It suppresses the code pulse. */
  const QUIET_NO_CODE = QUIET;

  let dpr = 1, W = 0, H = 0, cx = 0, cy = 0, R = 0, N = 0, phone = false;

  let seed = 1907;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const g3 = () => (rnd() + rnd() + rnd() - 1.5) * 0.8;   // rough normal
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  /* ---- per-particle state ---- */
  let pos, G = {}, mag, temp, sharp, pulph, role, city, bit, dphase;
  const P = { sx: null, sy: null, dp: null, pr: null, vis: null };
  let prevX = null, prevY = null, order = null;

  function build() {
    seed = 1907;
    N = phone ? 520 : 1200;

    pos   = new Float32Array(N * 3);
    mag   = new Float32Array(N);
    temp  = new Float32Array(N);
    sharp = new Float32Array(N);
    pulph = new Float32Array(N);
    role  = new Uint8Array(N);     // 1 = land
    city  = new Uint8Array(N);
    bit    = new Uint8Array(N);    // which glyph this particle shows: 1 or 0
    dphase = new Float32Array(N);  // when in the morph it turns into a digit
    P.sx = new Float32Array(N); P.sy = new Float32Array(N);
    P.dp = new Float32Array(N); P.pr = new Float32Array(N);
    P.vis = new Uint8Array(N);
    prevX = new Float32Array(N); prevY = new Float32Array(N);
    order = new Int32Array(N); for (let i = 0; i < N; i++) order[i] = i;

    const earth = new Float32Array(N * 3);

    /* --- per-particle variation. The star field this fed is gone, but the
           variation is still what stops the globe reading as a printed
           halftone: dots differ in size and brightness, and the twinkle
           driven by sharp/pulph keeps the surface alive while it turns.
           Kept in this order — rnd() is a seeded sequence, so reordering
           these calls reshuffles the geography that follows. --- */
    for (let i = 0; i < N; i++) {
      mag[i]   = Math.pow(rnd(), 2.4);
      temp[i]  = 0.25 + rnd() * 0.75;      // biased blue-white
      sharp[i] = rnd();
      pulph[i] = rnd() * TAU;              // asynchronous by construction
    }

    /* --- the globe, and the only geometry there is. Land points come first
           in the packed set, so the land/ocean split is a straight stride
           through it.

           0.70 of the set is land against a real land fraction of ~0.29.
           That is deliberate and it is the whole reason the continents are
           recognizable: an honest 0.29 spends two thirds of the budget on
           empty ocean, where a dot carries no information, and leaves the
           coastlines too sparse to name. The ocean still gets its 0.30,
           which is enough to close the sphere behind the land. --- */
    const gp = geoPts(), oceanAvail = gp.length / 2 - LAND_N;
    const nLand = Math.round(N * 0.70), nOcean = N - nLand;
    const TILT = 0.41;                                    // ~23.5 deg axial tilt
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    for (let i = 0; i < N; i++) {
      let la, lo;
      if (i < nLand) {
        role[i] = 1;
        const k = Math.min(LAND_N - 1, Math.floor(i * (LAND_N / nLand)));
        la = gp[k * 2]; lo = gp[k * 2 + 1];
        city[i] = rnd() < 0.09 ? 1 : 0;
      } else {
        const j = i - nLand;
        const k = LAND_N + Math.min(oceanAvail - 1, Math.floor(j * (oceanAvail / nOcean)));
        la = gp[k * 2]; lo = gp[k * 2 + 1];
      }
      const cl = Math.cos(la * RAD);
      const x = cl * Math.cos(lo * RAD), y = Math.sin(la * RAD), z = cl * Math.sin(lo * RAD);
      const xt = x * ct - y * st, yt = x * st + y * ct;    // tilt the axis
      earth[i * 3] = xt; earth[i * 3 + 1] = yt; earth[i * 3 + 2] = z;
    }

    /* --- the code pass. Assigned LAST on purpose: every rnd() above
           feeds geography that is already signed off, and rnd() is a
           seeded sequence, so inserting a draw earlier would reshuffle
           every particle downstream of it.

           dphase staggers when each particle flips to a glyph, so the
           digits ripple across the continents instead of the whole set
           snapping over on one frame. Skewed by 0.8 to bunch them
           slightly early — the read is "it turned into code", and that
           lands better if most of the digits are up before the
           midpoint. --- */
    for (let i = 0; i < N; i++) {
      bit[i] = rnd() < 0.5 ? 1 : 0;
      dphase[i] = Math.pow(rnd(), 0.8);
    }

    G = { earth };
    pos.set(earth);
  }

  /* ---- bloom as tinted sprites drawn with drawImage. A per-particle
         createRadialGradient would cost more than every dot combined. ---- */
  function sprite(c) {
    const s = 64, el = document.createElement('canvas');
    el.width = el.height = s;
    const g = el.getContext('2d');
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0.00, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
    rg.addColorStop(0.16, `rgba(${c[0]},${c[1]},${c[2]},0.24)`);
    rg.addColorStop(0.48, `rgba(${c[0]},${c[1]},${c[2]},0.06)`);
    rg.addColorStop(1.00, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    return el;
  }

  /* ---- glyph sprites for the code pass. Two canvases, "1" and "0",
         drawn once and then blitted per particle. fillText 1200 times a
         frame with a colour change between each call is the one thing in
         this file that would actually drop frames.

         Baked in the accent cyan rather than each particle's own star
         colour. Two reasons: a per-particle tint would need either a
         sprite per colour or a composite pass per glyph, and the digits
         are supposed to read as one system asserting itself over the
         field — a warm digit next to a cool one reads as noise. ---- */
  function glyph(ch) {
    const s = 32, el = document.createElement('canvas');
    el.width = el.height = s;
    const g = el.getContext('2d');
    // Monospace: the digits are meant to read as a terminal, and a
    // proportional "1" next to a "0" reads as typography instead.
    g.font = '700 24px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = `rgb(${CYAN[0]},${CYAN[1]},${CYAN[2]})`;
    g.fillText(ch, s / 2, s / 2 + 1);
    return el;
  }

  /* ---- the code pulse envelope, on the SETTLED globe.

         Takes seconds since the Earth arrived and returns 0..1: 0 while
         the globe is plain, rising to 1 at the peak of a pulse, back to
         0 after it. Repeats every CODE_EVERY.

         It used to be a function of morph position — the digits lived
         inside the stars→Earth transition. They now live on the globe
         instead, so the driver is a clock, not a progress value.

         Raised to the 0.85 power for the same reason as before: opens
         and closes a little faster than a sine, leaving a longer flat
         top where the digits are fully up and legible. ---- */
  function codeWin(sinceSettle) {
    if (sinceSettle < CODE_WAIT) return 0;
    const k = (sinceSettle - CODE_WAIT) % CODE_EVERY;
    if (k >= CODE_RUN) return 0;
    return Math.pow(Math.sin(k / CODE_RUN * Math.PI), 0.85);
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wasPhone = phone;
    phone = W <= 720;
    // The object (globe / galaxy / ring) is anchored right of the copy on BOTH
    // desktop and phone. It used to be centred on a phone, which put it behind
    // the headline: the only way to keep the words legible was to dim it, and a
    // dimmed globe under text reads as haze rather than a planet. Now the copy
    // owns the left, the planet owns the right, and neither has to be faded.
    //
    // On a phone the globe deliberately BLEEDS off the right edge (cx beyond W
    // minus a fraction of R): a 390px viewport cannot hold a whole sphere and a
    // column of type side by side, so what shows is a large bright limb — the
    // edge of a planet — instead of a small complete ball. Reads as intent.
    // On a phone the globe sits in the UPPER RIGHT and the copy sits BELOW it,
    // so the two separate vertically instead of competing for a 390px width.
    // A first attempt pushed the sphere off the right edge entirely (cx beyond
    // W) — with land-only, near-side-only dots that left a handful of specks on
    // the edge, which read as dirt rather than a planet. Keep it mostly on
    // screen: a little crop on the right is fine, a sliver is not.
    R = phone ? Math.min(W * 0.50, H * 0.27) : Math.min((W - W * 0.60) / 2.05, H * 0.34);
    R = Math.max(96, R);
    cx = phone ? W * 0.70 : W - Math.max(20, W * 0.015) - R;
    cy = phone ? H * 0.29 : H * 0.50;
    if (wasPhone !== phone || !pos) build();
  }

  /* ---- copy protection. The field spans the whole hero, so its left end
         is dimmed under the headline. Type wins, always. ---- */
  function mask(sx) {
    // No horizontal fade on a phone: the globe occupies the upper right and the
    // copy sits underneath it, so the separation is VERTICAL and an x-based ramp
    // would only dim the planet's own left limb for no reason. The scrim in the
    // CSS handles the band where the type actually is.
    if (phone) return 1;
    const x0 = W * 0.24, x1 = W * 0.56;
    if (sx <= x0) return 0.26;
    if (sx >= x1) return 1;
    return 0.26 + 0.74 * (sx - x0) / (x1 - x0);
  }

  let HALO = null, GLYPH = null;
  function frame(t) {
    if (!HALO) HALO = { cool: sprite(COOL), warm: sprite(WARM), cyan: sprite(CYAN), gold: sprite(GOLD) };
    if (!GLYPH) GLYPH = [glyph('0'), glyph('1')];
    ctx.clearRect(0, 0, W, H);

    /* --- no sequence to be at a position in. The geometry is the globe,
           always, so there is nothing to interpolate and no stage to pick.
           The only clocks are the fade out of black and the code pulse. --- */
    const fade = t < INTRO ? ease(t / INTRO) : 1;
    pos.set(G.earth);
    const wGlobe = 1;                       // always a globe; kept named for the draw code
    const wCode = QUIET_NO_CODE ? 0 : codeWin(t);

    /* --- camera: one regime, constant rotation. No sway, no handover, no
           seam to get wrong — that complexity existed only to hand a star
           field over to a globe, and there is no star field now.

           YAW0 is where the planet starts, and it is not arbitrary: it is
           solved so the FIRST frame already shows Africa and Europe square
           to camera, the most nameable face there is. The visitor arrives on
           a recognisable Earth rather than on whichever ocean the clock
           happened to land on (an earlier version ran yaw off absolute time
           and opened on the west Pacific).

           SPIN 0.030 rad/s ≈ 3.5 min a revolution. Slow enough to read as
           stately rather than as a spinning globe icon, and slow enough that
           the face stays nameable for the whole first minute.

           Pitch is a fixed slight tilt: it puts the north pole a little away
           from the camera so the sphere reads as a body with an axis, not as
           a flat disc of dots. No dolly — nothing is arriving, so there is
           nothing to arrive toward. --- */
    const YAW0 = -1.0;                        // rad: opens on Africa / Europe
    const SPIN = 0.030;                       // rad/s, endless
    const yaw = YAW0 - SPIN * t;
    const dolly = 0;
    const pitch = -0.10;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);

    for (let i = 0; i < N; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const X = x * cyw + z * syw, Z = -x * syw + z * cyw;
      const Y2 = y * cp - Z * sp, Z2 = y * sp + Z * cp + dolly;
      const pr = PD / (PD - Z2);
      P.sx[i] = cx + X * R * pr;
      P.sy[i] = cy + Y2 * R * pr;
      P.dp[i] = Z2; P.pr[i] = pr;
      P.vis[i] = (P.sx[i] > -40 && P.sx[i] < W + 40 && P.sy[i] > -40 && P.sy[i] < H + 40) ? 1 : 0;
    }

    /* --- Earth's air: a haze ring on the limb plus a dark ocean wash, so
           the globe reads as a body and not a shell of dots --- */
    if (wGlobe > 0.02) {
      const rr = R * 1.02;
      const hz = ctx.createRadialGradient(cx, cy, rr * 0.80, cx, cy, rr * 1.20);
      hz.addColorStop(0, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0)`);
      hz.addColorStop(0.62, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${0.11 * wGlobe * fade})`);
      hz.addColorStop(1, `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},0)`);
      ctx.fillStyle = hz;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.20, 0, TAU); ctx.fill();
      // The wash closes the far side of the sphere so near-side dots read as
      // sitting on a body. Lighter than the lit-globe value it replaced —
      // this globe is mostly dotted, and a heavy wash swallowed the dots.
      ctx.fillStyle = `rgba(12,22,44,${0.30 * wGlobe * fade})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 0.985, 0, TAU); ctx.fill();
    }

    /* --- particles, far to near --- */
    Array.prototype.sort.call(order, (i, j) => P.dp[i] - P.dp[j]);

    /* Day/night for the Earth beat. Fixed, so the terminator stays put while
       the globe sways under it.

       Re-solved when the camera was anchored to the loop: the old vector was
       aimed at a face the camera no longer visits, which left Africa and
       Europe sitting on the night side and the whole globe reading dim. This
       one is the surface normal at 22°N 90°E, tilt applied, chosen so that
       across the Earth hold western Europe and the Sahara are lit, southern
       Africa falls off into gradient, and the terminator crosses the
       Atlantic — which is what puts the warm city lights on the dark limb
       instead of hiding them round the back. */
    const LX = -0.149, LY = 0.344, LZ = 0.927;

    for (let k = 0; k < N; k++) {
      const i = order[k];
      if (!P.vis[i]) { prevX[i] = P.sx[i]; prevY[i] = P.sy[i]; continue; }
      const sx = P.sx[i], sy = P.sy[i], pr = P.pr[i];
      const mk = mask(sx);
      const near = clamp01((P.dp[i] + 2.2) / 4.4);

      /* --- colour: star temperature first, then the globe stages override
             with land / ocean / city-light --- */
      const tw = 0.78 + 0.22 * Math.sin(t * (0.6 + sharp[i] * 0.9) + pulph[i]);   // twinkle
      const bright = (0.30 + 0.70 * mag[i]) * (0.55 + 0.45 * near);

      let cr = WARM[0] + (COOL[0] - WARM[0]) * temp[i];
      let cg = WARM[1] + (COOL[1] - WARM[1]) * temp[i];
      let cb = WARM[2] + (COOL[2] - WARM[2]) * temp[i];
      let a = bright * (0.55 + 0.45 * tw);
      let rad = (0.5 + 1.5 * mag[i]) * (0.72 + 0.5 * sharp[i]) * pr;

      if (wGlobe > 0.02) {
        // The surface normal is the model position, not the rotated one: the
        // lighting must not swim with the camera.
        const nx2 = pos[i * 3], ny2 = pos[i * 3 + 1], nz2 = pos[i * 3 + 2];
        const nl = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2) || 1;
        const lit = clamp01((nx2 * LX + ny2 * LY + nz2 * LZ) / nl * 1.5 + 0.30);
        const isCity = city[i] === 1 && lit < 0.22;
        let tr, tg, tb, ta, trd;
        if (isCity) {
          tr = GOLD[0]; tg = GOLD[1]; tb = GOLD[2];
          ta = 0.55 * (0.4 + 0.6 * tw); trd = 1.15 * pr;
        } else if (role[i] === 1) {
          tr = LAND[0]; tg = LAND[1]; tb = LAND[2];
          ta = (0.16 + 0.74 * lit) * (0.55 + 0.45 * near); trd = 1.25 * pr;
        } else {
          tr = OCEAN[0]; tg = OCEAN[1]; tb = OCEAN[2];
          ta = (0.07 + 0.34 * lit) * (0.5 + 0.5 * near); trd = 1.0 * pr;
        }
        /* The two globe passes are now one beat, so this single frame has to
           be both things at once: a lit Earth AND the brief's "digital globe
           of individual glowing particles". flat is the mix, held constant.

           0.55 leans to the dotted look — that is the half he approved, and
           the lift is what makes the coastline read. What the remaining 0.45
           buys is the day/night terminator and the warm city lights, which
           a fully flat globe throws away.

           Land and ocean separate on THREE channels at once (alpha, radius,
           hue), not just alpha: at 0.72 against 0.30 with an identical dot
           size the coastlines did not read at all. */
        const flat = 0.55;
        // Land 1.0 against ocean 0.11 (was 0.92 / 0.13). The globe is 636px
        // across carrying ~840 land points, so a coastline is a thin line of
        // small dots — it needs the top of the range, and widening the gap
        // against the ocean is what turns "a sphere of dots" into a shape you
        // can name.
        ta = ta * (1 - flat) + (role[i] === 1 ? 1.0 : 0.11) * (0.6 + 0.4 * near) * flat;
        if (flat > 0.3 && !isCity && role[i] === 0) {
          // Only the ocean cools toward cyan; land keeps the pale starlight
          // white, which is what gives the coastline its edge.
          tr += (CYAN[0] - tr) * 0.45 * flat;
          tg += (CYAN[1] - tg) * 0.45 * flat;
          tb += (CYAN[2] - tb) * 0.45 * flat;
        }
        // Land dots also grow (1.70 → 2.05): alpha alone tops out at 1 and the
        // coastline still read faint, so the remaining headroom is in area.
        trd = trd * (1 - flat) + ((role[i] === 1 ? 2.05 : 0.95) * pr) * flat;

        const g = clamp01(wGlobe);
        cr += (tr - cr) * g; cg += (tg - cg) * g; cb += (tb - cb) * g;
        a = a * (1 - g) + ta * g; rad = rad * (1 - g) + trd * g;
      }

      // (Particle 0 used to be Polaris, the star field's bright anchor. With
      // the field gone it is just another dot on the globe, so there is no
      // special case here any more.)

      a = clamp01(a) * mk * fade;
      if (a < 0.012) { prevX[i] = sx; prevY[i] = sy; continue; }

      /* --- the code pulse, ON the globe: "instead of dots inside of Earth -
             light numbers and then back to dots".

             Two deliberate restrictions, because the point is that the
             PLANET lights up from within, not that the screen fills with
             text:

             LAND ONLY. The ocean dots stay dots throughout. If the whole
             sphere turns to digits the continents vanish and the read is
             "a ball of text" rather than "the Earth, computing". Keeping
             the ocean as dots is what holds the shape while the land
             flickers over.

             NEAR SIDE ONLY. dp > 0 is the hemisphere facing the camera —
             literally the dots "inside" the visible disc. Digits on the far
             limb would be back-to-front and read as noise on the edge.

             dphase staggers the flip so the digits ripple across the
             continents instead of the whole set snapping at once; the 0.55
             spread means a given particle is a glyph for a bit over half
             the pulse, so there are always some dots left. --- */
      let gw = 0;
      if (wCode > 0.02 && role[i] === 1 && P.dp[i] > 0) {
        gw = clamp01((wCode - dphase[i] * 0.55) / 0.45);
      }
      if (gw > 0.02) {
        // The glyph replaces the dot rather than sitting on top of it: two
        // marks for one particle breaks the "same object, new form" read.
        const gs = Math.max(7, (7.5 + 5.0 * mag[i]) * pr);
        ctx.globalAlpha = a * gw;
        ctx.drawImage(GLYPH[bit[i]], sx - gs / 2, sy - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        // What is left of the particle's alpha is what still draws as a dot,
        // so the crossfade between the two forms conserves brightness.
        a *= 1 - gw;
        if (a < 0.012) { prevX[i] = sx; prevY[i] = sy; continue; }
      }

      /* --- streaks: a fast particle is drawn as the line it travelled.
             This is where "points stretch into thin trails" comes from. --- */
      const vx = sx - prevX[i], vy = sy - prevY[i];
      const v = Math.sqrt(vx * vx + vy * vy);
      // The t guard skips the very first frames, where prevX/prevY are still
      // zero and every particle would otherwise draw one bogus streak from
      // the origin. Small absolute value now that nothing waits on the intro.
      if (v > 2.6 && t > 0.1) {
        const cap = Math.min(v, 34);
        ctx.strokeStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${a * 0.55})`;
        ctx.lineWidth = Math.max(0.55, rad * 0.7);
        ctx.beginPath();
        ctx.moveTo(sx - vx / v * cap, sy - vy / v * cap);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      prevX[i] = sx; prevY[i] = sy;

      /* --- the dot itself. fillRect for the faint majority (far cheaper
             than 1200 arcs a frame), arc plus bloom for the anchors. --- */
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${a})`;
      if (rad < 1.15) {
        const d = Math.max(1, rad * 1.7);
        ctx.fillRect(sx - d / 2, sy - d / 2, d, d);
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
      }

      // Controlled glow, only where it earns it.
      const lit = city[i] && wGlobe > 0.4;
      if (i === 0 || mag[i] > 0.72 || lit) {
        const hr = rad * (i === 0 ? 9 : 5.5);
        const sp2 = i === 0 ? HALO.cyan : (lit ? HALO.gold : (temp[i] > 0.6 ? HALO.cool : HALO.warm));
        ctx.globalAlpha = Math.min(0.85, a * (i === 0 ? 1.0 : 0.55));
        ctx.drawImage(sp2, sx - hr, sy - hr, hr * 2, hr * 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  let raf = 0, running = false, last = 0, clock = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; clock += dt;
    frame(clock);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  /* Reduced motion gets one static frame of the plain dotted Earth, fully
     faded up. Timed deliberately inside the pre-pulse beat (t < CODE_WAIT) so
     it can never freeze on half a screen of digits — a still frame of a
     half-finished code pulse looks like a rendering bug, not a design. */
  const STILL = INTRO + 0.5;
  if (reduce) { frame(STILL); return; }

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    // Geometry is normalised, so a resize only remaps to screen. The clock is
    // kept, so the sequence does not restart from the intro.
    rz = setTimeout(() => { resize(); if (!running) frame(clock || STILL); }, 150);
  }, { passive: true });
})();

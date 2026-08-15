/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse team data from spreadsheet
// Format: Region, Province, IshampLogin, RTO, LeaderName, LeaderNIC, LeaderTP, MemberName, MemberNIC, MemberTP
const rawData = [
  ["Metro","Metro - 1","SLTSHK_T16","R-HK","Muditha Prabath","953481057V","717932149","Muditha Prabath","953481057V","717932149"],
  ["Metro","Metro - 1","SLTSHK_T24","R-HK","Manoj Prasangana","953481065V","704683466","Manoj Prasangana","953481065V","704683466"],
  ["Metro","Metro - 1","SLTSHK_T27","R-HK","D.Kasun Lasantha","932511215V","755576890","D.Kasun Lasantha","932511215V","755576890"],
  ["Metro","Metro - 1","SLTSHK_T29","R-HK","L.N Thilina","95793985V","704556082","L.N Thilina","95793985V","704556082"],
  ["Metro","Metro - 1","SLTSHK_T19","R-HK","Nimantha Dissanayake","200329012586","740462290","Nimantha Dissanayake","200329012586","740462290"],
  ["Metro","Metro - 1","SLTSMD_T30","R-MD","Champika Nishantha","761361333v","714179234","Sandeepa Nadeeranga","200712002777","770725226"],
  ["Metro","Metro - 1","SLTSMD_T5","R-MD","Channa Jayasanka","871290300v","717941797","Salman Khan","200535803801","",""],
  ["Metro","Metro - 1","SLTSMD_T4","R-MD","Chaminda Manjula","197520103365","717095001","R. Janapriya Lal","690272580V","",""],
  ["Metro","Metro - 1","SLTSMD_T1","R-MD","Mihira Mahesh","751980841v","777631843","","",""],
  ["Metro","Metro - 1","SLTSMD_T31","R-MD","Mahesh Ranasinghe","900423500V","764316290","","",""],
  ["Metro","Metro - 1","SLTSMD_T25","R-MD","Janith Chathuranga","962650139V","758460120","Danuka prsanna","800500028v","718760477"],
  ["Metro","Metro - 1","SLTSHK_T12","R-MD","Ishan Madushanka","200213302270","703269671","Sunimal Pires","196618303297","759219299"],
  ["Metro","Metro - 1","Direct Team","R-MD","Keshan Snajeewa","Direct Team","Direct Team","Dhanuka Niroshan","Direct Team","Direct Team"],
  ["Metro","Metro - 1","SLTSKON_T33","R-KX","P.K.Thilina Udaya Kumara","199809203649","702628054","G.Ishara Shyamika Rekshan","200427700987","785154234"],
  ["Metro","Metro - 1","SLTSKX_T7","R-KX","G.W.Upul Warnakumara","771062482V","741747250","D.S.Buddhika Kasun","198736400405","756269712"],
  ["Metro","Metro - 1","SLTSKON_T27","R-KX","Menaka Niroshan","862720571V","775111895","Jagath Pushpakumara","802834217V","777494515"],
  ["Metro","Metro - 1","SLTSKON_T22","R-KX","P.G.Pasindu Chamika","941141366V","702101415","R.M.Nishitha Nilupul","200027802443","707891991"],
  ["Metro","Metro - 1","SLTSKX_T9","R-KX","S.Shathuna Samidda","200407710451","713322647","M.A.S.Rukshan","861940721V","714275719"],
  ["Metro","Metro - 1","SLTSKON_T14","R-KX","Anurada de Silva","198308700849","715933151","Mewan Sulochana","932963728V","783375541"],
  ["Metro","Metro - 1","SLTSKON_T28","R-KX","Asantha Sajith","199435402341","720871763","Damith Tharaka","",""],
  ["Metro","Metro - 1","SLTSHO_T47","R-KX","Yumal Rukshitha","199913210140","778159187","Gayan Priyadarshana","199214004387","725903838"],
  ["Metro","Metro - 1","SLTSKON_T25","R-KX","Savear Alowsiyes","672713234V","772257754","Hiran Nimesha","200234611796","705234156"],
  ["Metro","Metro - 2","SLTSAW_T11","R-ND","Ajith Nilanga","823024185V","779282361","Dissanayaka","631592805V","-"],
  ["Metro","Metro - 2","SLTSHO_T18","R-ND","Sanjaya Amal priyankara","902452508V","742848714","Hashan buddika","199924010253","",""],
  ["Metro","Metro - 2","SLTSHO_T21","R-ND","M.P.D.N. Dilshan","199930711431","705840017","D.A.R.L Senawirathne","200429000821","",""],
  ["Metro","Metro - 2","SLTSHO_T15","R-ND","Harashana","982873169V","788515729","Samith","198728302920","",""],
  ["Metro","Metro - 2","SLTSRM_T19","R-ND","Rasika Sampath","923502025v","762931677","Thilak","760614408V","788363376"],
  ["Metro","Metro - 2","SLTSKON_T4","R-ND","Maduranga","962291961V","769400741","","",""],
  ["Metro","Metro - 2","SLTSHO_T21","R-ND","M.D Dilshan Madushanka","200131001502","764681988","N.H Saran Wishwajith","200414702982","0771651046"],
  ["Metro","Metro - 2","SLTSHO_T30","R-ND","Sadun","198312501123","714958798","Suranga","198505700620","766251785"],
  ["Metro","Metro - 2","SLTSHO_T42","R-RM","Dilip","199406604856","777110608","Tharindu","-","",""],
  ["Metro","Metro - 2","SLSRM_T55","R-RM","Dinesh Gamage","","760917996","Ajantha","781223000V","-"],
  ["Metro","Metro - 2","SLTSRM_53","R-RM","Dilan Madusanka","200136203908","","gihan imansha","980572935v","",""],
  ["Metro","Metro - 2","SLTSRM_46","R-RM","T.S.D.Peris","831771062v","771907599","Thisara","19991014149","-"],
  ["Metro","Metro - 2","SLTSRM_47","R-RM","Upul sandaruwan","901073171v","704890680","Duminda pushpa kumara","963262434v","-"],
  ["Metro","Metro - 2","SLTSRM_41","R-RM","K.K.I.D. Shamika","982640121v","712087911","Charidu","200821404752","-"],
  ["Metro","Metro - 2","SLTSRM_22","R-RM","M.dinidu priyanath","198719903661","719512301","-","-","-"],
  ["Metro","Metro - 2","SLTSRM_37","R-RM","G.sirisena","","710632052","Ruwan Priynatha","842972930v","719322395"],
  ["Metro","Metro - 2","SLTSPH_11","R-RM","H.A.P.S.Kumara","913364562","","Ruchira","","",""],
  ["Metro","Metro - 2","SLTSHO_T9","R-HO","Lakmal Perera","199123801153","719139370","Devindu Sampath","200510800853","769189108"],
  ["Metro","Metro - 2","SLTSAW_T9","R-HO","Dileepa Kumara","199525610070","765376725","Selvadorei Yogaraj","198900610024","776798343"],
  ["Metro","Metro - 2","SLTSHO_T50","R-HO","Aloka Pathum","200707601420","740435218","Sanoj Piyushan","199215403093","703115359"],
  ["Metro","Metro - 2","SLTSKI_T25","R-HO","Kasun Jayalath","960593049V","703528178","Hashan Ranga","941103413V","705713978"],
  ["Metro","Metro - 2","SLTSHO_T26","R-HO","Champika Rathnayake","890313981V","701078182","-","-","-"],
  ["Metro","Metro - 2","SLTSAW_T26","R-HO","Ishan Madusanka","981790766V","758651095","Akila Maduranga","200310313568","753546393"],
  ["Metro","Metro - 2","SLTSHO_T51","R-HO","Anushka Kumara","199930110599","704223766","Januka Chethana","200427501273","714612634"],
  ["Metro","Metro - 2","SLTSHO_T7","R-HO","A.L.V. Gunawardhana","902693211V","714683611","Supun Rashmika","200131001502","713825238"],
  ["Metro","Metro - 2","SLTSHO_T41","R-HO","Dilina Suvimal","","","","",""],
  ["Region - 1","WPN","SLTSKI_T34","R-KI","Dilan Madusanka","911330334V","716347285","Dilan madusanka","911330334V","716347285"],
  ["Region - 1","WPN","SLTSKI_T26","R-KI","Dilan Madusanka","911330334V","716347285","Susantha","911330334V","716347285"],
  ["Region - 1","WPN","SLTSKI_T27","R-KI","Dilan Madusanka","911330334V","716347285","Sumith indika","911330334V","716347285"],
  ["Region - 1","WPN","SLTSGQ_T28","R-KI","Sisira Kumara","652691781v","767835663","Sisira","652691781v","767835663"],
  ["Region - 1","WPN","SLTSKI_T9","R-KI","Dinusha Madushan","","702800201","Perera","","702800201"],
  ["Region - 1","WPN","SLTSKI_T35","R-KI","Mohan senawiwikrama","","711239878","Asanka","","711239878"],
  ["Region - 1","WPN","SLTSKI_T15","R-KI","Duminda","","711046447","Duminda","","711046447"],
  ["Region - 1","WPN","SLTSGQ-T3","R-GQ","A.K.C.S.Abesingha","810222492V","702433902","A.Jayawardhana","842060818V","778716267"],
  ["Region - 1","WPN","SLTSGQ_T13","R-GQ","P.A.Saman","","","Hasalaka","","",""],
  ["Region - 1","WPN","SLTSGQ_T30","R-GQ","A.A.S.N.Darmasena","","","Sujeewa Bandara","","",""],
  ["Region - 1","WPN","SLTSGQ_T31","R-GQ","T.A.V.Pieris","","","Dharmasena","","",""],
  ["Region - 1","WPN","SLTSHO_T6","R-GQ","M.Ramyalatha","962714390V","711494699","Pubudu Wijesena","","",""],
  ["Region - 1","WPN","SLTSGQ_T36","R-NTB","Wijenayaka","770931274V","786608376","Shantha","","",""],
  ["Region - 1","WPN","SLTSKI_T13","R-NTB","Balasooriya","","718334930","Ashoka","","",""],
  ["Region - 1","WPN","SLTSGQ_T22","R-NTB","Sunil Dayarathna","721280500V","719138775","Malka","","",""],
  ["Region - 1","WPN","SLTSKI_T12","R-NTB","Manjula","731440697V","773534473","Chaminda","","",""],
  ["Region - 1","WPN","SLTSNG_T4","R-NG","Sujith Premathilak","820162706V","766670783","Akila Sampath","943141819v","786620907"],
  ["Region - 1","WPN","SLTSNG_T7","R-NG","Gayan Wijekoon","841992385v","787722601","Tiran Shashika","200032504793","787722601"],
  ["Region - 1","WPN","SLTSNG_T35","R-NG","Sachithra Premathilaka","820162706V","777443054","Dasun sameera","851621164v","777443054"],
  ["Region - 1","WPN","SLTSNG_T57","R-NG","Shanaka Kumara","198230300991","774492052","Shanos","200812902405","7662777052"],
  ["Region - 1","WPN","SLTSNG_T27","R-NG","H.V.M.Sampath","881920417v","7777451456","Udara Rajapaksha","950743018v","742737464"],
  ["Region - 1","WPN","SLTSNG_T38","R-NG","Waruna rasanga","882654796V","703112225","J.A.C.Chathuranga Jayakodi","198020700438","703111225"],
  ["Region - 1","WPN","SLTSNG_T54","R-NG","Ajith Paththaduwana","771700446V","777145836","K L Danushka Kriyawasam","960112113V","770705859"],
  ["Region - 1","WPN","SLTSNG_T59","R-NG","A.M.K.Gimhan Senarathna","199801410043","0703743530","S.R.Madushan Fernando","200615000451","703538009"],
  ["Region - 1","WPN","","R-NG","R.K. Samantha","","","N.A. Srimal","","",""],
  ["Region - 1","WPN","SLTSKI_11","R-WT","Pasindu Sadaruwan","952961721v","756328546","Pasindu Sadaruwan","952961721v","756328546"],
  ["Region - 1","WPN","SLTSWT_T11","R-WT","W.L.M.Sampath","771490867V","716541472","W.L.M.Sampath","771490867V","716541472"],
  ["Region - 1","WPN","SLTSWT_T10","R-WT","R.H.Isuru Madushan","971382465v","755196449","R.H.Isuru Madushan","971382465v","755196449"],
  ["Region - 1","WPN","SLTSWT_T19","R-WT","Chathuranga Nipun","973323253v","764999477","Chathuranga Nipun","973323253v","764999477"],
  ["Region - 1","WPN","SLTSWT_T28","R-WT","R.H.Dilan","200229401246","0769220965","R.H.Dilan","200229401246","0769220965"],
  ["Region - 1","WPN","SLTSWT_T3","R-WT","H.D.N.Perera","197617700390","712457976","H.D.N.Perera","197617700390","712457976"],
  ["Region - 1","WPN","SLTSWT_T21","R-WT","T.V.P.Senarath Rupasinghe","673532047V","0776026773","T.V.P.Senarath Rupasinghe","673532047V","0776026773"],
  ["Region - 1","WPN","SLTSWT_T35","R-WT","H.F.Sithum Chamila","932383217v","751214939","H.F.Sithum Chamila","932383217v","751214939"],
  ["Region - 1","WPN","SLTSWT_T39","R-WT","Buddhika Supun","2001132403390","707376385","Dilshan Priyadarshana","971746130V","758674945"],
  ["Region - 1","NWP","SLTS_KGT11","R-KG","L.A.M.T.K. Abesinghe","831040440V","706617710","Roshan Karunathilaka","872662790V","703159699"],
  ["Region - 1","NWP","SLTS_KGT7","R-KG","G.A.R.U.Kumara","802905025V","774009179","Dinesh Achiranga","983280528V","769439008"],
  ["Region - 1","NWP","SLTS_KGT9","R-KG","A.P Rupasinghe","891933290V","778322497","Dilshan Prdeep","200318314200","763160685"],
  ["Region - 1","NWP","SLTS_KGT15","R-KG","B.M.C.Jayathilaka","942250126V","715742344","Ishan Chethiya","200509203466","704534720"],
  ["Region - 1","NWP","SLTS_KGT5","R-KG","J.A.R.Balasooriya","872360719V","715650083","Anushka Priyanath","963444079V","717002776"],
  ["Region - 1","NWP","SLTS_KGT14","R-KG","Sujith Dhammika","722003349V","750161870","Asela","780551240V","758563120"],
  ["Region - 1","NWP","SLTS_KGT12","R-KG","Sajith tharanga","199330601841","778630413","Thushara thilakshana","991760733V","789620232"],
  ["Region - 1","NWP","SLTS_KGT17","R-KLY","R.D. Lakmal Jayasinghe","892992754V","703365585","R.D Madushanka Pirish","892992754V","785888867"],
  ["Region - 1","NWP","SLTS_KGT13","R-KLY","U.K.D.A. Joseph","551952045V","767632737","Nipuna","913050665V","769189546"],
  ["Region - 1","NWP","SLTSKG_T23","R-KLY","Sujith Kumara","199810500134","704989025","Nimesh Kasun","200125805276","769947868"],
  ["Region - 1","NWP","SLTCW_T19","R-CW","Anjula Madhusanka","971363410V","707641108","Mangala Prabath","197722603970","741747496"],
  ["Region - 1","NWP","SLTCW_T22","R-CW","Prasad Weerawardhena","198914301538","742831043","J.H.A Sasith","941641520V","774381940"],
  ["Region - 1","NWP","SLTSCW_T16","R-CW","G.A.N Akalanka","900961111V","760012637","H.Sanjeewa","","",""],
  ["Region - 1","NWP","SLTSCW_T23","R-CW","J.M Hishara","200125700630","778341305","Thilak Fransisku","198024403196","724144456"],
  ["Region - 1","NWP","SLTSCW_T9","R-CW","P.P.Pradeep Ruwansiri Herath","199131904950","779615126","Malesha Chathuranga","200709101847","779615126"],
  ["Region - 1","NWP","DIRECT TEAM","R-CW","A.M.G.D.K. Karunarathne(Direct)","","","J.H.N. Malsha","","",""],
  ["Region - 1","NWP","DIRECT TEAM","R-CW","B.M.S.P. Sanjeewa(Direct)","","","R.M.D.P.K. Gunathilaka","","",""],
  ["Region - 1","NWP","Direct Team","R-CW","Y.G.D.L. Karunarathne(Pole)","","","M.M. Nilantha Pushpakumara","","",""],
  ["Region - 1","CP","SLTSHT_T4","R-HT","G.W Harsha sandun (Direct)","941373500V","703223941","K.M Sasanka Sandun","199617102297","717457008"],
  ["Region - 1","CP","SLTSGP_T29","R-HT","S.Vivegantharaja","900362579V","762282484","Nimaleshan","199915110578","775575547"],
  ["Region - 1","CP","SLTSNW_T1","R-NW","B.D.K.G Sujeewa Darshana(Direct)","970761683V","712463586","susantha Thisera","850133778V","715400050"],
  ["Region - 1","CP","SLTSGP_T2","R-GP","Nalin","950233117V","754276790","Dineth","990791791V","758520403"],
  ["Region - 1","CP","SLTSGP_T33","R-GP","Dinal","200618100280","714555070","Dananjaya","20031573252","704742615"],
  ["Region - 1","CP","SLTSKY_T4","R-GP","Prasanna","951651540V","752676122","Kavindu","200533602007","781553891"],
  ["Region - 1","CP","SLTSKY_T11","R-KY","Pamuditha Gabadage","960211707V","766522738","Gayan","981391071V","765331885"],
  ["Region - 1","CP","SLTSGP_T16","R-KY","Nadeera","952093460V","783667060","Chamil","850754594V","761335945"],
  ["Region - 1","CP","SLTSGP_T14","R-KY","Thusitha Ruwan","810782994V","704180043","M.T Bandara","2006633604237","704180043"],
  ["Region - 1","CP","SLTSGP_T24","R-KY","Thusitha Daramasena","930781827V","703478891","","N/A","N/A"],
  ["Region - 1","CP","SLTSGP_T10","R-KY","Gamini","771822320V","766318071","Prabodha Ekanayake","971401524V","766967425"],
  ["Region - 1","CP","SLTSHT_T02","R-KY","Thilak","900431171V","702105603","Chaminda Silva","752441197V","776315218"],
  ["Region - 1","CP","N/A","R-KY","H M G K H Bandara","200100704083","767459742","D.M. Madushan Bandara","200219800450","764339986"],
  ["Region - 1","CP","SLTSMT_T1","R-MT","N.A.S.Thilakarathna","880340344V","703712894","W.G.C. Dharmarathna","781533238V","703712730"],
  ["Region - 1","CP","SLTSDB_T10","R-MT","K.G.N.P.Anandage","922030774V","703773177","K.W.G. Namadasa","712202280V","715468129"],
  ["Region - 1","CP","SLTSDB_T11","R-MT","Madusanka Samarasinghe","941593577V","712824828","W.G.D.P. Dharmakeerithi","913240642V","717787835"],
  ["Region - 1","CP","SLTSMT_T3","R-MT","P.L.B.Batugedara","932361639V","778659132","Chalaka Indrarathna","200010600282","762665484"],
  ["Region - 1","CP","SLTSDB_T12","R-MT","I.G.H.D.Senavirathna","200034802818","786019761","Sisira Dissanayake","200207500214","743628360"],
  ["Region - 2","SAB&Uva","SLTSBD_T9","R-BD","R.M.Kasun udayanga","990121150V","750623770","H.M.Maleesha Shenal","200303912530","768555259"],
  ["Region - 2","SAB&Uva","DIRECT TM","R-BD","P.V. Asanka","","","Kelum Dissanayaka","","",""],
  ["Region - 2","SAB&Uva","SLTSBD_T7","R-BW","R.M.S.D.Ekanayaka","942144490V","773250644","G.Susantha Gamage","823092873V","712909550"],
  ["Region - 2","SAB&Uva","DIRECT TM","R-BW","Pathum Anjula","","","Hashan Madushanka","","",""],
  ["Region - 2","SAB&Uva","SLTSMRG_T1","R-MRG","G.Ravidu Sandeepa","199634402351","71718752725","Thisara","","",""],
  ["Region - 2","SAB&Uva","SLTSHB_T4","R-MRG","S.K.Pattiarachchi","803340501V","710590274","","",""],
  ["Region - 2","SAB&Uva","SLTSKE_T2","R-KE","K.R.C.D. Werake (Direct)","952772970V","0715954717","P.D. Amila Rohan (Direct)","198912402077","0710828342"],
  ["Region - 2","SAB&Uva","SLTSKE_T3","R-KE","H. R. S. Senanayake (Direct)","963303378V","0703712884","Rajitha Weragama (Direct)","913302672V","0752870702"],
  ["Region - 2","SAB&Uva","SLTSKE_T21","R-KE","D.M.A. Dharamarathna","197505801544","0766286058","H. Chandra Pushpakumara","830293590V","0740530075"],
  ["Region - 2","SAB&Uva","SLTSKE_T24","R-KE","M.R.G. Buddika","872214488V","0702390471","G. R. S. R. Wijerathne","910561260V","0714144288"],
  ["Region - 2","SAB&Uva","SLTSKE_T27","R-KE","W. G. D. Chathuranga","990180962V","0774395130","H.P Dulan mangala","200507205133","0789131716"],
  ["Region - 2","SAB&Uva","SLTSKE_T28","R-KE","I.P.U.N.K. Jayarathne","920573029V","0773320010","S. A. Manoj Nuwan","200105803646","0755680315"],
  ["Region - 2","SAB&Uva","SLTSKE_T29","R-KE","A. Pathum Malshan","200617001830","0764077284","A. K. Nawodaya","200631402552","0763166791"],
  ["Region - 2","SAB&Uva","SLTSRN_T5","R-RN","A.D.Chamara Jayantha Prasad","771082807V","724748408","Rumesh Achintha","200235804200","767497719"],
  ["Region - 2","SAB&Uva","SLTSRN_T4","R-RN","A.B.Wijayarathna","670901670V","763549940","A.V.Hasitha Hemal Diyas","892414327V","779945067"],
  ["Region - 2","SAB&Uva","SLTSKE_T17","R-RN","H.W.Sajeewa Wasantha Gunathilaka","198435003748","716600558","Lakshan Tharaka Wellawaththa","200504300290","714182869"],
  ["Region - 2","SAB&Uva","SLTSRN_T7","R-RN","B.R.C Kumara","890293794V","775638662","H.A.Lasntha Chandrasena","903300507V","771179833"],
  ["Region - 2","SAB&Uva","SLTSAW_T25","R-RN","Kasun Dewaka","","7166789346","Awishka","","",""],
  ["Region - 2","SAB&Uva","SLTSRN_T1","R-RN","Hansa Gayeshan Devinda","Direct Team","710826599","Asiri Indika","DIRECT TM","717337034"],
  ["Region - 2","SAB&Uva","SLTSRN_T8","R-RN","Sasanka Lakshmitha","Direct Team","","Chamod Batagoda","200634803333","765704217"],
  ["Region - 2","SP","SLTSHB_T6","R-HB","M.K.Waruna","891393334v","702973848","","962152694V","702180033"],
  ["Region - 2","SP","SLTSEMB_T8","R-HB","K.D.Sandaruwan","941313400V","705157944","Tharaka Sampath","","773755298"],
  ["Region - 2","SP","SLTSEMB_T10","R-HB","Dinesh","","773755298","","",""],
  ["Region - 2","SP","SLTSHB_T5","R-HB","Mendis(S.S. Eng.)","","704990098","Lahiru Sandaruwan","","",""],
  ["Region - 2","SP","SLTSMH_T27","R-MH","Saliya Siriwardana","198922101124","713560249","Nimesh Heshan","200910701172","743461484"],
  ["Region - 2","SP","SLTSGL_T9","R-MH","M.Chamika Sampath","822774423V","763760385","G.A Damith Nishantha","961611989V","769967925"],
  ["Region - 2","SP","SLTSMH_T18","R-MH","H.H.P.S Kumara","931872028V","741926425","","",""],
  ["Region - 2","SP","SLTSMH_T22","R-MH","Lahiru Arunodha Sampath","199108002003","703516202","Tharaka Sathruwa","200111004695","767985533"],
  ["Region - 2","SP","SLTS_T19","R-MH","Sanjitha Lakmal","801803628V","N.A","Jeewan Priyankara","Jeewan","",""],
  ["Region - 2","SP","Direct Team","R-MH","Himansa Rusiru(Direct)","","","Janidu","","",""],
  ["Region - 2","SP","SLTSGL_T3","R-GL","Dhanuka Sadaranga","198433503550","712215150","P.A.Chaminda","791093120V","715342165"],
  ["Region - 2","SP","SLTSPH_T8","R-GL","Kusal Madushanka","910484222V","719590005","Prasanna Udayakumara","923282041V","755988679"],
  ["Region - 2","SP","SLTSGL_T8","R-GL","Ruwan Tharaka","922613958V","764055198","Nilanga Manoraj","","770666781"],
  ["Region - 2","SP","SLTSAG_T15","R-GL","Manuka Umesh","200205400651","72464263","Ravindu Sandeepa","200213401466","752585906"],
  ["Region - 2","SP","SLTSGL_T11","R-GL","Sandaruwan Gunawardana","200010104310","701825001","Gihan Sandeepa","200605803680","765455246"],
  ["Region - 2","SP","SLTSAG_T14","R-GL","Kushan Tharuka","","758093402","Himash Adithya","200227500912","740234537"],
  ["Region - 2","WPS","SLTSGL_T1","R-AG","Aruna Siriwardana","662780308V","722494050","Anushka","810054","776051469"],
  ["Region - 2","WPS","SLTSAG_T19","R-AG","Supun Tharuka","990450170V","760003257","Channuka","200313712052","754020055"],
  ["Region - 2","WPS","SLTSGL_T6","R-AG","Menaka Indrajith","751392680V","775442103","H.A. Piyasena","650081187V","776959534"],
  ["Region - 2","WPS","SLTSMH_T14","R-AG","Chathuranga","199808900724","759127161","Rohana","197206501785","772542002"],
  ["Region - 2","WPS","","R-AG","Susantha","","","","",""],
  ["Region - 2","WPS","SLTSPH_T1","R-HR","Nirmal Navod","200303000000","789070440","Dulshan Sampath","200232000000","762023786"],
  ["Region - 2","WPS","SLTSHR_T5","R-HR","Rukshan","970860975V","713388295","Wasantha Premakumara","851350497V","719105318"],
  ["Region - 2","WPS","SLTSHR_T7","R-HR","Anuja Basnayaka","197808000000","772170315","U.K.D.C Madusanka","963532610V","762326170"],
  ["Region - 2","WPS","SLTSHR_T32","R-HR","Tharanga Preamarathna","200334000000","706720662","W.G.D. Kumara","","",""],
  ["Region - 2","WPS","SLTSHK_T25","R-HR","Chathuranga","200016000000","754943619","Lahiru Sadaruwan","","754943619"],
  ["Region - 2","WPS","SLTSHR_T52","R-HR","Tharindu Gamage","","706352443","K.D.M.D. Kumarage","","",""],
  ["Region - 2","WPS","SLTSHR_T13","R-KT","Wasantha Dilshan","19821450131","776227783","Sugeera Sadaruwan","199819603520","786486701"],
  ["Region - 2","WPS","SLTSHR_T28","R-KT","Nipun Chandula","972800716V","779052719","Imesh Anuradha","199902510068","754127858"],
  ["Region - 2","WPS","SLTSKT_T4","R-KT","Meegha Dhananjaya","9619424011V","702802091","Kavindu Akash","","762974789"],
  ["Region - 2","WPS","SLTSHR_T44","R-KT","Jeewan chathuranga","863590159v","756540014","Umesh dulshan","992193301V","",""],
  ["Region - 2","WPS","SLTSHR_T9","R-KT","Gayan sampath","870301553V","757684313","G.D. Vihanga Hirushan","200730202334","751459380"],
  ["Region - 2","WPS","SLTSHR_T40","R-KT","Kasun Chamara","973020242V","787834972","Pasidu Madushanka","200515000000","775577960"],
  ["Region - 2","WPS","SLTSHR-T43","R-PH","B.Gayan Hasuntha mendis","820190190V","711389517","B.Inura Mendis","200936301639","717777968"],
  ["Region - 2","WPS","SLTSPH_T3","R-PH","Dasun Udayanga","963123256V","705980107","Anupa theeksha","200204002780","788436871"],
  ["Region - 2","WPS","SLTSHR_T19","R-PH","Sadaru Nenthum","200203102870","751144834","Tharaka devinda","200336113138","727205855"],
  ["Region - 2","WPS","SLTSHR_T25","R-PH","Chamara Madushanka","200234201211","715175709","Akila Saranga","200314410139","760309068"],
  ["Region - 2","WPS","SLTSKT_T7","R-PH","Lahiru Geethanga Fenando","971820209V","766312132","Rvindu Promoda Lakmal","200722803533","769109738"],
  ["Region - 2","WPS","SLTSHR_T45","R-PH","Dilana geesadu","200417604487","764287726","Lakshika Nuwan kumara","200035304168","701109817"],
  ["Region - 2","WPS","SLTSHR_T15","R-PH","Shehan Vidura","200136300505","764989569","A .Sadaruwan","","762737621"],
  ["Region - 2","WPS","SLTSKT_T12","R-PH","Manjula Jayasooriya","943202745V","776797889","Kavindu Theekshana","20020002021","742664283"],
  ["Region - 3","EP","SLTSAP_T6","R-AP","N.K Thomas","883251172v","752458954","D.M Mahela suranjith","200029802469","758417661"],
  ["Region - 3","EP","SLTSBC_T6","R-BC","A.Suvendran","892111286v","770875927","Krishnaraj","","756335023"],
  ["Region - 3","EP","SLTS_BCT11","R-BC","Yathushan","200035903385","710428484","M. Kukesh","200432300650","752867245"],
  ["Region - 3","EP","SLTSBC_T1","R-BC","N.Vimalanathan","842093759V","701560480","Aathavan Dilakshanth","962843085V","703065608"],
  ["Region - 3","EP","SLTSKL_T8","R-KL","Kugaraj","951422746V","756569005","T.Thasitharan","199115802309","701378807"],
  ["Region - 3","EP","SKTSTC_2","R-TC","K.D. Asitha Anura Kumara","990210489V","710829932","Anuradha Jayakodi","922852634V","715851074"],
  ["Region - 3","EP","","R-TC","Rajendran Thusyanth","199100810027","702838782","Nixshan Thanushan","981143370v","758221571"],
  ["Region - 3","EP","SLTSTC_12","R-TC","N.M.Nishath","200033303413","755675946","Ihsan","199836310270","756178535"],
  ["Region - 3","EP","SLTSPR_T7","R-PR","Piyal Rathnayake","850844194V","717110272","Nalaka pushpakumara","890884288V","767074977"],
  ["Region - 3","EP","SLTSPR_T8","R-PR","U.L.S.N.Perera","200224102960","757450518","K.A.Kaveesha Nethsara","200635600613","783812434"],
  ["Region - 3","EP","Direct Team","R-PR","Lalith Kumarasiri","Direct Team","Direct Team","Sumith Ekanayaka","Direct Team","Direct Team"],
  ["Region - 3","NP","SLTSJA_T10","R-JA","Ravithas Shathmeekan","19963240045","724738074","Leonsius Jackson","199935901084","705117589"],
  ["Region - 3","NP","SLTSJA_T16","R-JA","S. Thamailventhan","20003335200145","757201796","N.Nitharshan","993151475V","741372524"],
  ["Region - 3","NP","SLTSJA_T17","R-JA","S.Sharujan","200002602418","762051473","S.Jeakaran","992624353V","762458755"],
  ["Region - 3","NP","SLTSJA_T5","R-JA","T. Gobinath","951000248v","766484927","N.Satheeskumar","200108001767","762362670"],
  ["Region - 3","NP","SLTSJA_T20","R-KO","A. Mathushan","200307700507","7151210118","K.Thanusanth","200525203295","751710756"],
  ["Region - 3","NP","SLTSMB_T1","R-MB","K.Bahirathan","199502302030","760300344","K.Thanuskanna","200105700030","768060278"],
  ["Region - 3","NP","Covered by an AD Team","R-VA","","","","","",""],
  ["Region - 3","NP","SLTSAD_T2","R-AD","L.P.Kariyawasam","198027002302","710169161","K.A.D.P.Kurukulasooriya","932173115V","768067996"],
  ["Region - 3","NP","SLTSAD_T10","R-AD","A.N.N.T.Narayana","200229402447","0706652671","C.Y.H.Lunuwila","200317312369","781100047"],
  ["Region - 3","NP","SLTSAD_T6","R-AD","S.M.N.M.Samaranayake","980512673V","716281711","S.A.A.Prasad","782685139V","779202488"],
  ["Region - 3","NP","SLTSAD_T7","R-AD","S.N.M.S.M.Bandara","198917703412","774956456","A.A.H.Harshaka","200229401254","710954232"],
  ["Region - 3","NP","SLTSAD_T11","R-AD","G.G.S.P.Kularathne","199023201497","702854454","W.I.I.A.Illangasinghe","199632610116","716789912"],
  ["Region - 3","NP","SLTSAD_T13","R-AD","S.D.N.A.Jayasiri","1998203071","711516949","J.K.S.Udekumara","2003087179","773402936"],
];

async function main() {
  console.log("Seeding Contractor Teams from spreadsheet data...");

  // 1. Create "SLTS Direct" contractor for Direct Team entries
  let sltsDirectContractor = await prisma.contractor.findFirst({ where: { name: "SLTS Direct" } });
  if (!sltsDirectContractor) {
    sltsDirectContractor = await prisma.contractor.create({
      data: {
        name: "SLTS Direct",
        type: "SOD",
        status: "ACTIVE",
        contactNumber: "0112345678",
        email: "direct@slts.lk"
      }
    });
    console.log("Created SLTS Direct contractor");
  }

  // 2. Group data by Ishamp login (team code)
  const teamGroups = new Map();
  for (const row of rawData) {
    const [region, province, ishampLogin, rto, leaderName, leaderNic, leaderTp, memberName, memberNic, memberTp] = row;
    
    // Skip empty rows
    if (!leaderName || leaderName.trim() === "") continue;
    
    const isDirect = ishampLogin.toLowerCase().includes("direct") || ishampLogin === "" || ishampLogin === "N/A" || ishampLogin === "Covered by an AD Team";
    const teamKey = isDirect ? `DIRECT-${rto}-${leaderName}` : ishampLogin;
    
    if (!teamGroups.has(teamKey)) {
      teamGroups.set(teamKey, {
        region,
        province,
        ishampLogin: isDirect ? "DIRECT" : ishampLogin,
        rto,
        isDirect,
        members: []
      });
    }
    
    // Add leader
    if (leaderName && leaderNic !== "Direct Team" && leaderNic !== "N/A" && leaderNic !== "-") {
      teamGroups.get(teamKey).members.push({
        name: leaderName.replace(/\(Direct\)/g, "").trim(),
        nic: leaderNic,
        contactNumber: leaderTp,
        designation: "Team Leader"
      });
    }
    
    // Add member
    if (memberName && memberNic !== "Direct Team" && memberNic !== "N/A" && memberNic !== "-" && memberName !== leaderName) {
      teamGroups.get(teamKey).members.push({
        name: memberName,
        nic: memberNic,
        contactNumber: memberTp,
        designation: "Team Member"
      });
    }
  }

  console.log(`Found ${teamGroups.size} unique teams`);

  // 3. Create contractors and teams
  let contractorCount = 0;
  let teamCount = 0;
  let memberCount = 0;

  for (const [teamKey, teamData] of teamGroups) {
    // Find or create contractor
    let contractor;
    if (teamData.isDirect) {
      contractor = sltsDirectContractor;
    } else {
      // Use team leader name as contractor name
      const leaderName = teamData.members.find(m => m.designation === "Team Leader")?.name || teamKey;
      contractor = await prisma.contractor.findFirst({ where: { name: leaderName } });
      if (!contractor) {
        contractor = await prisma.contractor.create({
          data: {
            name: leaderName,
            type: "SOD",
            status: "ACTIVE",
            contactNumber: teamData.members.find(m => m.designation === "Team Leader")?.contactNumber || null,
            nic: teamData.members.find(m => m.designation === "Team Leader")?.nic || null
          }
        });
        contractorCount++;
      }
    }

    // Find OPMC
    const opmc = await prisma.oPMC.findUnique({ where: { rtom: teamData.rto } });
    if (!opmc) {
      console.warn(`OPMC not found for RTO: ${teamData.rto}`);
      continue;
    }

    // Create team
    const teamName = teamData.isDirect 
      ? `Direct Team - ${teamData.rto} (${teamData.members.find(m => m.designation === "Team Leader")?.name || "Unknown"})`
      : `${teamData.ishampLogin} - ${teamData.members.find(m => m.designation === "Team Leader")?.name || "Unknown"}`;

    const team = await prisma.contractorTeam.create({
      data: {
        name: teamName,
        sltCode: teamData.isDirect ? null : teamData.ishampLogin,
        contractorId: contractor.id,
        opmcId: opmc.id,
        status: "ACTIVE"
      }
    });
    teamCount++;

    // Create members
    for (const member of teamData.members) {
      await prisma.teamMember.create({
        data: {
          name: member.name,
          nic: member.nic || null,
          contactNumber: member.contactNumber || null,
          designation: member.designation,
          contractorId: contractor.id,
          teamId: team.id
        }
      });
      memberCount++;
    }
  }

  console.log("\nSeeding complete!");
  console.log(`Contractors created: ${contractorCount}`);
  console.log(`Teams created: ${teamCount}`);
  console.log(`Members created: ${memberCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

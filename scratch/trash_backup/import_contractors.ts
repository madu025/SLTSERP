import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const contractorsData = `Amantha Sandaruwan??	SLTSND_T22	712562259
Trishan Kaveesha	SLTSGQ_T45	769075995
Harshana Dilan	SLTSGQ_T46	753134600
Nethmi Umaya??	SLTSGQ_T47	717874916
Lahiru	SLTSMH_T22	703516202
Induka	SLTSMH_T23	707464524
Tharidu dilshan	SLTSKI_T31	754411465
Sulochana madumali	SLTSGP_T35	710829820
Sai tec JA 9	SLTSJA_T19	766484927
Awantha perera	SLTSGQ_T50	711280066
Mahawaduge Charidu Saderu piris	SLTSRM_T50	779902318
Thilina	SLTSHK_T29	704556082
Chamod Dilanka	SLTSGP_T38	704866418
Lasantha Kumara	SLTSGP_T39	705760770
Gihan Lakshitha	SLTSKI_T33	716347285
K.G. Sadun Prasanna	SLTSRM_T48	705768165
K. Vidura Navodya	SLTSRM_T49	705768166
Aloka Pathum	SLTSHO_T50	740435218
Sahan thiwanka	SLTSGQ_T51	752629626
Nishantha	SLTSMD_T30	741379234
Rajitha Lakmal	SLTSRM_T51	705558192
Bethmage Tharindu Gimhana	SLTSRM_T52	769105031
Buddhika	SLTSKX_T7	774257986
R.M.R GUNARATHNA	SLTSCW_T22	742831043
Tharindu Madushan	SLTSHO_T33	743013620
P.A Madhura Pahanpriya	SLTSGQ_T42	762960252
Dilina Suvimal	SLTSHO_T41	702061548
Kavindu	SLTSGL_T15	755445348
Kaveesha gimhan	SLTSWT_T37	767022438
Janith Lahiru Sampath	SLTSHO_T45	759763785
Alanraj	SLTSKL_T11	717487448
Anoma dissanayake	SLTSGP_T34	703940225
Prasanna Ranmuthuge	SLTSMD_T28	718760477
Akalanka Peiris	SLTSRM_T45	701859400
T S D Peiris??	SLTSRM_T46	771907599
Vimukthi dananjaya	SLTSWT_T35	742217343
Rasika Laksara	SLTSAW_T28	701729834
Jayamuni Kalubowilalage	SLTSHO_T39	716369897
Gayashan herath	SLTSCW_T24	762712070
Eranda	SLTSKX_T8	706271838
Menaka	SLTSKI_T30	705118878
Rathan??	SLTSMB_T1	760300344
Sai tec JA 8	SLTSJA_T16	762362670
Sai??tec??JA??10	SLTSJA_T20	760257619
Madumal Ranawaka	SLTSKI_T32	719880716
Anjula	SLTSAP_T7	715256027
Hashan Ranga	SLTSHO_T49	705713978
Siriwardana	SLTSMH_T27	773560249
Anushka Kumara	SLTSHO_T51	774323766
Sulakshana Nirmali	SLTSMD_T29	705735250
Chathura ??Malinga	SLTSGP_T36	718627177
I. G. H. D. Senavirathna	SLTSDB_T12	741408159
N.v.Nuwan chathuranga.	SLTSHO_T52	770864901
N.Jathusan	SLTSBC_T11	710428484
LAKSHAN CHATHURANAGA	SLTSCW_T23	771428595
Supun	SLTSAG_T19	760003257
Dulanja chathuranga	SLTSRM_T43	768900767
T.A.P.Peris	SLTSRM_T44	741240609
Sandaruwan	SLTSGL_T11	766184183
Sivakumar	SLTSAP_T4	701560479
Naroonshake	SLTSAP_T5	702180328
K. Chanaka Sanjeewa??	SLTSHO_T35	719204557
Nuwan??	SLTSHK_T26	701805689
Maduwantha Dahanayake	SLTSWT_T34	702784485
Kasun	SLTSHK_T27	755576890
W.E.Nawodya Perera	SLTSHO_T37	743156015
M.H.Lakni shalika malwenna	SLTSAG_T20	707464526
W.A.Dilan Madushanka??	SLTSHO_T42	766734627
Madhusanka Samarrasinghe	SLTSDB_T11	712824828
Nadeeranga	SLTSMD_T25	770725226
M. A. Suranga	SLTSKX_T9	707891991
Dinal Rashmika	SLTSGP_T33	750439130
Pathum Lakshitha	SLTSRM_T47	704890680
Gihan	SLTSGL_T16	765455246
Senadhirathna	SLTSKX_T10	703231382
Thilina	SLTSKON_T33	766952276
VIHANGA	SLTSGQ_T48	764305055
Niroshan kumara	SLTSAP_T6	752458954
Yashan Balapitiya	SLTSHO_T46	781148142
Achintha Madushan	SLTSMD_T26	768259330
Sai tec JA 7	SLTSJA_T17	751316574
Sai tec JA 6	SLTSJA_T18	751710756
Janith chathuranga	SLTSMD_T27	758460119
Pasan Ravindu	SLTSGQ_T49	752596972
Tharindu Promod	SLTSAW_T17	762686256
Nadeera	SLTSGP_T16	742667060
Asantha	SLTSKON_T28	720871763
Linesh	SLTSRM_T36	704926640
Dinuka Perera	SLTSHO_T24	718752741
T.RUWAN PRIYANTHA	SLTSRM_T37	702622744
K.K. Ruvin shamika periris	SLTSRM_T38	787738086
Dushan Pabasara	SLTSGQ_T39	702179911
YM Engineering	SLTSKI_T28	702773127
Piyal	SLTSPR_T7	761154730
Sithum Chamila	SLTSWT_T31	754225562
Isuru Chamath	SLTSAD_T14	702180053
Jayasinghe Constructions	SLTSPR_T8	705027025
Dinesh	SLTSGP_T28	772887802
Sai TecJA5	SLTSJA_T10	705117589
W.k.anjula madushanka franando	SLTSCW_T19	707641108
P.L.B. Batugedara	SLTSMT_T3	778659132
M.Ishan madhusanka	SLTSAW_T26	758651095
Ravindu	SLTSGL_T12	752585906
Sai TecJA4	SLTSJA_T11	705123475
Raju	SLTSGP_T29	762282484
Tharanga Peiris	SLTSRM_T42	743842190
Hasitha Maduranga	SLTSAW_T20	719696015
Chiran	SLTSRM_T27	715534179
Dilan Madushanka	SLTSKI_T24	706966725
Dilan Sampath	SLTSWT_T28	705136650
Isuru	SLTSKON_T30	765457463
Nivode Dilshan	SLTSND_T20	743148363
Dilshan Madushanka	SLTSHO_T21	704881313
Chiran Eminda	SLTSHO_T25	718752740
Sai Tech VA	SLTSVA_T1	705121054
Saman	SLTSAD_T13	711516949
Manuka	SLTSAG_T15	759171238
HasIith??	SLTSAG_T16	712416943
Champika Bandaranayake	SLTSND_T18	710820749
Gayan	SLTSHO_T15	704173302
Rajitha Sampath	SLTSRM_T28	712860670
Dinesh	SLTSRM_T29	702221779
P. Kimara	SLTSMH_T18	761423965
Sujith Peiris	SLTSRM_T31	775415701
Savear	SLTSKON_T25	740006348
Kasun Devaka	SLTSAW_T25	766789346
K.K.D.I.Shamika	SLTSRM_T41	765815764
Upul Kumara	SLTSKI_T26	703624062
Dias	SLTSMH_T14	702485666
Dilshan Pathirana.	SLTSAW_T22	719599888
A.Suventhiran	SLTSBC_T6	770875927
W.M. THARINDU WICKRAMASINGHE	SLTSKON_T20	718752765
Pasan	SLTSAW_T24	756275427
Gihan Lakshitha	SLTSKI_T22	712417369
Wasantha Kumara	SLTSHO_T17	764858742
J.M.T.B.Jayasundara	SLTSDB_T9	714934839
Asiri	SLTSGQ_T34	703604110
Nadun Akalanka	SLTSCW_T16	760012637
Upul	SLTSPR_T5	701319160
Nishsanka	SLTSDB_T10	703773177
Pramod Senadeera	SLTSRM_T35	720312198
Danushka Pathum	SLTSHO_T22	718752749
Enura Sanjula	SLTSRM_T39	702035777
Prabhaswara	SLTSAD_T12	712860930
Sumith Indika	SLTSKI_T27	703624057
M H U Marasinghe	SLTSGP_T23	714683426
Sanjeewa	SLTSRM_T40	715981742
Supun Kossinhala	SLTSAD_T11	702854454
W A D Sandun Darshana	SLTSHO_T27	714958798
Dhammika	SLTSAG_T12	754020055
R. Danushka Lakmal	SLTSKG_T17	742566690
Janaka Chethana	SLTSRM_T25	703716601
N M Sanjaya amal priyankara	SLTSHO_T18	742848714
Dharmasena	SLTSGP_T24	703478891
Wijenayake	SLTSGQ_T36	786608376
Thilina Sampath	SLTSHO_T23	741755771
Champika Rathnayaka	SLTSHO_T26	701078182
Janith Chamara	SLTSND_T21	756499233
Sopithas	SLTSKL_T8	706676123
Imesh	SLTSAG_T14	705118193
Wasantha Gamage	SLTSHO_T29	715238198
L.N Muditha	SLTSHK_T24	704683466
Sandun	SLTSHO_T30	726233415
Kanishka sadaruwan	SLTSHO_T31	774948448
Duminda	SLTSKI_T15	711046447
S.M.Bandara	SLTSAD_T7	707914791
UMESH MADHUSHANKA	SLTSKON_T5	772641447
Dhanushka	SLTSCW_T11	712271552
Manjula Sampath	SLTSWT_T11	712148180
Dhananjaya Kavinda	SLTSHK_T5	701560861
Hasindu Kulasinghe	SLTSAW_T6	712273005
Ruwani	SLTSGQ_T15	712272569
Wishwanath	SLTSAW_T7	769875105
Sajana	SLTSAW_T10	756587510
Duleeka Sampath	SLTSHO_T11	705855082
Ajith Nilanga	SLTSAW_T11	779282361
Roshan Kumara	SLTSAG_T4	716970511
Bhanuka Ravindu	SLTSKI_T10	757123771
G.D.S.D.Madushanka	SLTSHO_T12	762918257
Gamini	SLTSGP_T10	766318071
Shalika Maduranga	SLTSGQ_T27	718791901
Sisira Kumara	SLTSGQ_T28	740693096
Vidura Sampath	SLTSHO_T13	707324327
P.P. Pradeep Danushka Ruwansiri	SLTSCW_T9	776084890
Tharu Danushka	SLTSRM_T23	742363111
Sai tec JA3	SLTSJA_T5	760234529
Gayan Ranasinghe	SLTSGQ_T38	719713328
Chalaka Lakshitha	SLTSHO_T16	704595145
Sahan Shasindu	SLTSKI_T23	706271839
Muditha	SLTSHK_T16	717932149
Nipun Tharaka	SLTSAD_T10	706652671
Nimantha	SLTSHK_T19	740462290
Dinusha Madushan	SLTSKI_T9	743830966
Senarath Rupasinghe	SLTSWT_T21	701698110
Sai Tech JA2	SLTSJA_T4	705121057
Nimesh Madushan	SLTSAD_T6	716281711
Damith sanjaya	SLTSAP_T3	741663720
Dinindu Priyanath	SLTSRM_T22	704114028
Damith Suranga	SLTSHO_T14	707324326
THILINA UDAYAKUMARA	SLTSKON_T4	742251447
Mohamed Shabri	SLTSKON_T6	701560830
Dilipa Kumara	SLTSAW_T9	765376725
Dilshan	SLTSGQ_T23	705537208
Manjula de Silva	SLTSKI_T12	768529275
H.V.Chamika Deneth	SLTSAW_T12	755797714
Pasindu Sandaruwan	SLTSKI_T11	756328546
Chathuranga Nipun	SLTSWT_T19	702271544
A. Josoph	SLTSKG_T13	719774221
Sujith Dammika	SLTSKG_T14	715495981
Sachith Rathnayake	SLTSRM_T21	706013827
Sai tech JA1	SLTSJA_T3	705121018
Chaminda Jayathilaka	SLTSKG_T15	761190293
Ajitha	SLTSKON_T13	710821675
Balasooriya	SLTSKI_T13	718917732
Thusitha Ruwan	SLTSGP_T14	704180043
Janitha	SLTSGQ_T29	710822832
Sudath Darmasena	SLTSGQ_T30	707866813
Indika	SLTSAP_T2	702516778
Tharaka jayasinghe	SLTSGQ_T8	704492371
KASUN KUMARASINGHE	SLTSKON_T3	778371447
P A Saman	SLTSGQ_T13	719322930
Ayeshan Lahiru	SLTSKI_T8	712862892
Rasika Sampath	SLTSRM_T19	715391088
Hathurusinghe	SLTSGP_T8	705983198
Thilakarathna	SLTSDB_T5	701560837
Prasanna Udayakumara	SLTSAG_T5	755988679
Sajith Tharanga	SLTSKG_T12	778630413
M H U Marasinghe	SLTSGP_T13	778354241
Priyantha	SLTSGQ_T31	702316313
Anuradha	SLTSKON_T14	764124403
sithum sathsara	SLTSAW_T13	743102560
Pasindu Eranga	SLTSAW_T14	703743777
Tharindu Kalinga	SLTSAW_T15	703783777
Supun Madhushanka	SLTSAW_T16	703793777
Isuru Madushan	SLTSWT_T10	705196449
Sanjeewa	SLTSGQ_T14	762844526
Isuru	SLTSKY_T11	766522738
Dayarathna	SLTSGQ_T22	719138775
Kasun	SLTSAD_T1	710825831
Sadith	SLTSAD_T2	710169161
Chamith priyadarshana	SLTSAG_T1	712418891
Bodhiranga Dinesh	SLTSAW_T3	755530308
Malith Vithanage	SLTSHO_T9	706655351
Dushan	SLTSRM_T16	719713302
Nuwan	SLTSND_T11	714683523
KAVINDU	SLTSND_T12	703940169
Dasun	SLTSND_T13	718554940
Prasad Dissanayaka	SLTSMD_T12	714682724
Kasun Maduranga	SLTSMD_T13	712273022
Umayanga Jayasooriya	SLTSRM_T17	716408993
M. Sujith	SLTSRM_T18	716443351
Adithya Rathnayake	SLTSKI_T7	712272946
Piyumi Senanayake	SLTSGQ_T6	710828632
Sanjaya Deshapriya	SLTSNTB_T7	701318276
Ravindu Wimanga	SLTSGQ_T7	713247526
Sameera Kaduwela	SLTSAW_T4	710339264
Chathura Buddhika	SLTSAW_T5	703713301
Sanjeewa	SLTSHO_T6	711794699
Gunawardana	SLTSHO_T7	751326240
Perera	SLTSHO_T8	719139370
Sampath	SLTSMT_T1	703712894
Dharmarathne	SLTSMT_T2	703712730
Buddhika	SLTSPR_T1	703940218
Imran	SLTSNTB_T3	750555933
Cheranga	SLTSNTB_T4	703940179
Dilan Harsha	SLTSGQ_T1	706790784
Chaminda Abesinghe	SLTSGQ_T3	702433902
Kusal	SLTSPH_T8	719590005
Vimalanathan	SLTSBC_T1	701560480
Ravikumar	SLTSKL_T1	761630431
Aruna	SLTSGL_T1	773383620
Dhanuka	SLTSGL_T3	712215150
Jayasekara	SLTSGQ_T9	705079262
Chammika	SLTSCW_T3	701560769
Manuja	SLTSCW_T4	710820732
Thushan malindu	SLTSRM_T24	757996320
S.A.Chanaka Ishan	SLTSKG_T5	711428425
G.A.R.U.Kumara	SLTSKG_T7	774009179
Isuru Sameera	SLTSAW_T18	702858538
Madushanka	SLTSHO_T1	764681988
Tharindu Lakmal	SLTSGQ_T4	782622105
Thisara Devinda	SLTSKI_T6	703713096
Dhanuka Akalanka	SLTSKI_T1	716408935
 	SLTSKI_T2	718744260
Ravidu	SLTSRM_T1	751821892
Dinesh	SLTSRM_T2	761443351
Ushan	SLTSRM_T3	711275528
Sujith	SLTSRM_T4	757973806
Pasindu	SLTSRM_T5	710815681
Chanika	SLTSRM_T6	711412029
Champika	SLTSRM_T7	706655350
Akalanka	SLTSRM_T8	755782634
Amila	SLTSKY_T1	703940228
Mihira	SLTSMD_T1	704437308
Chaminda	SLTSMD_T4	717095001
Channa	SLTSMD_T5	717941797
Dhanushka	SLTSGL_T4	706645301
Lalendra	SLTSGL_T5	716096363
Menaka	SLTSGL_T6	775442103
Shehan	SLTSGL_T7	712418393
Tharaka	SLTSGL_T8	764055198
Peiris	SLTSRM_T10	777110608
Dilan	SLTSRM_T11	701791927
Kasun	SLTSRM_T13	717021716
Dulara	SLTSRM_T14	750117980
Jayashan	SLTSRM_T15	753567092
Nalinda Perera	SLTSWT_T3	712457976`;

async function main() {
    console.log("Starting contractor import...");
    const lines = contractorsData.split('\n');
    let imported = 0;
    let skipped = 0;

    for (const line of lines) {
        if (!line.trim()) continue;

        let parts = line.split('\t');
        if (parts.length < 2) {
            // Try fallback split if tabs are missing (sometimes copy-paste converts them to spaces)
            parts = line.split(/ {2,}/);
        }

        if (parts.length < 2) continue;

        const name = parts[0].trim().replace(/\?\?/g, '');
        const registrationNumber = parts[1].trim();
        const contactNumber = parts[2] ? parts[2].trim() : null;

        if (!registrationNumber) continue;

        try {
            // Check if already exists
            const existing = await prisma.contractor.findUnique({
                where: { registrationNumber }
            });

            if (existing) {
                console.log(`Skipping duplicate: ${registrationNumber}`);
                skipped++;
                continue;
            }

            await prisma.contractor.create({
                data: {
                    name,
                    registrationNumber,
                    contactNumber,
                    status: 'ACTIVE',
                    type: 'SOD'
                }
            });
            console.log(`Imported: ${registrationNumber} (${name})`);
            imported++;
        } catch (error) {
            console.error(`Error importing ${registrationNumber}:`, error);
        }
    }

    console.log(`\nImport finished.`);
    console.log(`Total lines: ${lines.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped (Duplicate): ${skipped}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

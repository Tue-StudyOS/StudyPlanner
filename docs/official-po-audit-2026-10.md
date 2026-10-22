# Official examination-regulation audit — October 2026

**Status: historical audit findings, followed by the source-backed correction.**
The investigation itself changed no runtime or user records. The discrepancies
below describe revision `cd738e2`, not the corrected implementation. Current
accounting, explicit recognition and migration behavior are documented in
[regulation-model.md](regulation-model.md). This remains guidance, not an
individual examination-board decision or a compliance certificate.

## Scope and sources

The audit covers the six supported PO-2021 profiles: B.Sc. Informatik,
Bioinformatik, Medieninformatik and Medizininformatik; M.Sc. Informatik and
Machine Learning. It also checks the Machine Learning amendment published in
2026. Older POs and individual recognition/admission decisions are outside this
comparison.

Inspected application revision: `cd738e2465d9573585000a6d0f5cccbb7b9f1d58`.
Public-data checks used all 481 returned catalog entries and all six live rule
profiles. Fifteen official PDFs were downloaded and text-extracted; PDF page
numbers below refer to those downloads, not browser page numbers.

The six files supplied in `einzupflegene_po/` exist, but they are derived JSON,
not the original legal documents. Their repeated `22.07.2022` PO date is not
supported by the examined special parts: these record Senate adoption on
11 March 2021, Rector approval/signature on 25 March 2021, and first application
in WS 2021/22. The Bachelor framework's first amendment is signed **22 July
2021**, not 2022. Do not confuse signing, publication, first applicability and
handbook revision dates.

The [source register](official-po-sources.json) records stable official URLs,
index pages, versions, PDF page counts and SHA-256 hashes. It deliberately omits
short-lived signed download URLs. Statutes and amendments control; university
reading copies are convenience editions. Handbooks supplement the statutes;
current ALMA allocations/advertised credits and examination-board decisions are
also needed for individual recognition.

## Summary by program

| Profile | Official structure / central rule | Discrepancy at the audited revision |
| --- | --- | --- |
| B.Sc. Informatik | 180 CP: 114 compulsory, 33 subject electives, 18 further übK, 15 Abschlussmodul. Math IV is **Stochastik or Numerik**, one 6-CP compulsory slot. | Live area totals match this structure, but the MATH badge, module-alternative enforcement and lecture/tutorial double crediting are wrong. Supplied JSON also has incorrect individual module amounts. |
| B.Sc. Bioinformatik | 180 CP. Math I–III are 9 each; **Stochastik 6 is compulsory**, not a free Numerik alternative. Abschlussmodul 15. | Live MATH target 30 conflicts with the 33 CP of these compulsory math modules; live THESIS target is 12. Multiple supplied module amounts are wrong. |
| B.Sc. Medieninformatik | 180 CP. Math I–III are 9 each; Ethics/Law 3 is compulsory. Subject electives are Informatik 9, Medieninformatik 12 and Medienwissenschaften 12. Abschlussmodul 15. | Live MATH target is 24, THESIS 12, and MEDIA_STUDIES 18. Supplied module amounts/required modules differ. Math can look complete without Math III. |
| B.Sc. Medizininformatik | 180 CP. Math I and II are 9 each; Biostatistik is a separate 3-CP module. `S06PLQ2` is compulsory, 3 CP. Abschlussmodul 15. | Live THESIS target is 12. Supplied Biostatistik is 6 and omits `S06PLQ2`; other module/elective amounts differ. Do not infer that Math III/IV are compulsory here. |
| M.Sc. Informatik | 120 CP: four 18-CP areas, **BASIS or FOKUS** 18, and thesis 30. At most three seminars overall. | Frontend alternative selection works. Seminar/module eligibility constraints and admission-prescribed BASIS requirements are not a complete centralized validation model. |
| M.Sc. Machine Learning | 120 CP: **24 / 36 / 18 / 12 + 30**. Seminar/practical limits, EXP grade exclusion and the 2026 General-CS restriction apply. | Live area amounts are correct, unlike the supplied 27/30 Foundations/Diverse values. Reproduced missing seminar limits, wrong EXP grade weighting and acceptance of a bachelor compulsory module in General CS. |

The earlier live area sums of 156/153/162 for the three related bachelor profiles
were a warning, not by themselves proof of a PO violation. The specific official
module amounts and missing requirements below establish the actual discrepancies.
Do not repair these profiles by merely forcing arbitrary area sums to 180.

## Verified bachelor requirements

### Informatik

Sources: [B-INF], §5, PDF pp. 2–3 / printed pp. 294–295; §10, PDF p. 4;
[HB-BSC], Informatik overview/module descriptions.

- Mathematics I, II and III: **9 CP each**. `INFM2020` Math IV: **6 CP**, with
  Stochastik **or** Numerik as alternatives for that one requirement.
- Practical Informatik 4 / Teamprojekt: **9 CP**, not the supplied JSON's 6.
- The compulsory total of 114 already includes the 3-CP Proseminar. The three
  specialized elective requirements are 6 each, plus Informatik electives 15.
- Overall übK is 21 CP: 3 integrated Proseminar CP plus 18 from `INFM6110` **or**
  `INFM1710`. The two 18-CP alternatives must not be added to one another.
- Abschlussmodul: **15 = 12 written thesis + 3 oral/colloquium**. The live 15-CP
  target is already correct; the supplied JSON's 12 CP "including presentation"
  is not. A standalone written-thesis achievement of 12 must not automatically
  be inflated to 15 without the oral component.
- A universal additional compulsory "Logik und Proseminar" requirement is not
  established by the §5 table. Possible focus/elective offerings must not be
  promoted into compulsory modules merely because they appear in a catalog.

### Bioinformatik

Sources: [B-BIO], §5, PDF pp. 2–3 / printed pp. 306–307; §10, PDF p. 4;
[HB-BSC], Bioinformatik overview at PDF p. 86 and program section pp. 83–113.

- Mathematics: **9 + 9 + 9 + Stochastik 6 = 33 CP**. Numerik does not replace the
  explicitly prescribed Stochastik module in this PO.
- Programming I/II are 9 each; Software Engineering 6; Teamprojekt 9. Both
  theoretical-informatics modules are 9 each.
- Bioinformatics Introduction: **3**, Fundamentals: **9**; the supplied values
  6 and 6 are wrong.
- ZMG: **12**, Chemie I: **12**, Chemie II: **6**, Neurobiology: **9**.
- The three subject electives are **6 CP each**: Informatik, life sciences and
  Bioinformatik, not the supplied 12/9/9.
- übK: **21 = Teamprojekt 9 + Proseminar 3 + Studium Professionale 9**. Integrated
  credits are already part of their modules, not additional degree credits.
- Abschlussmodul: **15 = 12 + 3**, not live/supplied 12.

### Medieninformatik

Sources: [B-MEDIA], §5, PDF pp. 2–3 / printed pp. 300–301; §10, PDF p. 4;
[HB-BSC], overview at PDF p. 54 and program section pp. 51–82.

- Mathematics I–III: **9 each**, not 9/9/6.
- Practical Informatik I/II, Technical Informatik II and Theoretical Informatik
  I/II are 9 each; Software Engineering 6; Teamprojekt 9.
- UX, Internet Technologies, Multimedia and Image Processing: **6 each**;
  Graphical Data Processing: **9**, not the supplied 6.
- Ethics/Law in Media Informatics: **3 compulsory CP**. The supplied structure
  omits this module.
- Elective requirements: **Informatik 9, Medieninformatik 12,
  Medienwissenschaften 12**, not an 18-CP compulsory media-studies block.
- übK: **21 = Teamprojekt 9 + Proseminar 3 + Ethics/Law 3 + Studium Professionale 6**.
- Abschlussmodul: **15 = 12 + 3**, not live/supplied 12.
- The original PO table has older/duplicate identifiers for Math III and Theo II.
  The current handbook overview identifies them as `INFM2010` and `INFM2410`
  respectively (PDF p. 54). Preserve source/version context when resolving such
  aliases; do not treat an unqualified code string as globally unambiguous.

### Medizininformatik

Sources: [B-MED], §5, PDF pp. 2–3 / printed pp. 312–313; §10, PDF p. 5;
[HB-BSC], overview at PDF p. 117 and program section pp. 114–147.

- Math I and II: **9 each**; Biostatistik: **3**, not supplied 6. An aggregate
  MATH bucket may also contain statistics: do not blindly replace its target
  with 18 without first defining which modules belong to it.
- Practical Informatik I/II: 9 each; Software Engineering 6; Teamprojekt **9**.
- Fundamentals of Bioinformatics: **9**, not 6; Telemedicine: **6**, not 3;
  Medical Visualization 6. Humanbiology I–IV and Physics I/II are 6 each.
- `S06PLQ2` (History, Theory and Ethics of Medicine): **3 compulsory CP**. It is
  not an INF-family identifier and is missing from the supplied structure.
- Subject electives: **Biology/Medicine 6, Informatik 6,
  Medical Informatics/Bioinformatics 12**, not 6/9/6.
- übK: **21 = Teamprojekt 9 + Proseminar 3 + S06PLQ2 3 + Studium Professionale 6**.
- Abschlussmodul: **15 = 12 + 3**, not live/supplied 12.

All four official module tables reconcile to 180 CP when alternatives and
integrated credits are handled correctly. A discipline bucket, a compulsory
requirement and an übK attribute are different dimensions; adding all their
amounts together would double-count legitimate integrated modules.

## Verified master requirements

### Informatik

Sources: [M-INF], §5, PDF pp. 3–4 / printed pp. 336–337; §10, PDF p. 5;
[HB-MSC], PDF pp. 10–13.

- INFO-PRAK, INFO-TECH, INFO-THEO and INFO-INFO: **18 CP each**.
- INFO-BASIS **or** INFO-FOKUS: **18**, not both. The raw group sum of 138 is
  therefore not itself an error: selecting one alternative yields 120 overall.
- FOKUS permits Informatik master-level offerings. BASIS can be prescribed
  individually at admission to compensate for missing Informatik knowledge;
  the app cannot infer an admission decision from whichever bucket has more CP.
- At most **three seminars overall**. The INFO-INFO handbook description also
  limits the described research-project option to **one project** (PDF p. 12 /
  printed p. 11). General claims that a seminar and a practical are each
  universally compulsory were not established by the reviewed rules.
- Abschlussmodul: **30 = 27 written thesis + 3 oral/colloquium**.
- Existing frontend FOKUS/BASIS selection was reproduced as working. This does
  not establish complete backend enforcement of every eligibility constraint.

### Machine Learning

Sources: [M-ML], §5, PDF pp. 3–5 / printed pp. 349–351; §9, PDF p. 6; §15,
PDF p. 7; [HB-ML], study plans at PDF pp. 9–10; [M-ML-AM1], PDF p. 2.

- **24 Foundations + 36 Diverse Topics + 18 General CS + 12 Expanded Perspectives
  + 30 thesis = 120 CP**. Live amounts already match. The supplied 27/30 split
  for Foundations/Diverse Topics must not replace them.
- At most **three seminars overall**. Within Diverse Topics: at most **6 CP
  from seminars** and at most **6 CP from a practical**.
- The stored "at least two of three core modules" note was not established by
  the inspected PO, amendment or relevant handbook material. The supplied
  "all three compulsory" wording is likewise not a substitute for an explicit
  applicable rule. Use the official 24-CP requirement and recognized offerings;
  obtain a precise source before imposing an additional core-count rule.
- Expanded Perspectives admits **graded** university modules, excluding sports,
  subject to recognition/capacity decisions. Their grades remain on the transcript
  but **do not enter the degree grade**. `kP` in the area table does not waive the
  requirement for graded component modules; the official FAQ expressly clarifies
  this. Computer-science modules are not categorically excluded from EXP.
- The amendment signed 16 December 2025 and published in 2026 changes General CS:
  Informatik master modules are eligible; bachelor modules must come from the
  **Informatik Wahlpflichtbereich**, not the compulsory bachelor core. It also
  replaces the language rule with English. The amendment takes effect on the day
  after publication; the file name is not an exact effective-date timestamp.
- Completion module: **30 = 27 + 3**. Both master POs permit up to 30 additional
  CP beyond degree requirements; additional achievements must not automatically
  become extra degree fulfillment or final-grade weight.

The FAQ also states that current module credits are recognized as advertised in
ALMA or the handbook. Example offerings and their historical credits must not be
turned into immutable title-based rules for every later semester.

## Reproduced implementation failures

These checks used public catalog records and pure calculations, or mocked
persistence/authentication. No live user records were read or written.

| Check | Actual result | Official requirement |
| --- | --- | --- |
| Informatik B.Sc. lecture + exercise for Math II, Practical Informatik II or Theoretical Informatik II | 18 CP for each pair | One 9-CP module, not two independent 9-CP achievements. [B-INF] §5. |
| Bioinformatik: Numerik assigned to MATH | 6 accepted CP, no unassigned warning | Numerik does not satisfy compulsory Stochastik. [B-BIO] §5. |
| Medieninformatik: Math I + Math II + Numerik | MATH displays 24/24, without Math III | Compulsory Math I–III are 9 each. [B-MEDIA] §5. |
| Four 3-CP seminars in M.Sc. Informatik | 12 CP accepted, no unassigned courses | Maximum three seminars overall. [M-INF] §5 table footnote. |
| Four 3-CP seminars in ML Diverse Topics | 12 CP accepted, no unassigned courses | Maximum three seminars overall and six seminar CP in Diverse Topics. [M-ML] §5. |
| Bachelor compulsory Analysis (`INF1010`) assigned to ML General CS | 9 CP accepted | Not an eligible bachelor Wahlpflicht module under the 2026 amendment. [M-ML-AM1] §5(4). |
| ML-CS: 6 CP grade 1.0; EXP: 6 CP grade 4.0 | Current grade statistic: 2.5 | Degree-grade calculation excludes EXP: 1.0 for these inputs. Earned credits remain 12. [M-ML] §15; [FAQ-ML]. |
| Same course submitted twice with different completed-row IDs | Two 6-CP rows passed to persistence; statistics count 12 | A second database row is not proof of a second curricular achievement. |
| `BIOINF4331` completed in an earlier semester, then its annotated-number alias planned later | 6 credited + 6 planned | Alias/offering changes must not bypass already-completed achievement checks. |

Historical implementation points at the audited revision included:

- `frontend/src/shared/utils/regulation.ts:173`: area-label construction drops
  `areaType`, losing the compulsory MAIN label.
- `frontend/src/features/planner/utils/plannerProgress.ts:181` and `:191–199`:
  sums entries and suppresses already-completed plans by catalog ID alone.
- `backend/src/services/user_completed_courses.py:735–805`: bulk replacement
  lacks an achievement-level duplicate check.
- `frontend/src/features/transcript/utils/studyStats.ts` and
  `backend/src/services/progress.py:495–508`: grade calculations exclude UEBK,
  but not ML-EXP. A raw all-achievement average must not be presented as a
  PO-compliant degree-grade forecast.

The special parts also prescribe a CP-weighted degree grade with only one
remaining decimal, further digits discarded without rounding (Bachelor and
Informatik master §16; ML §15). A two-decimal interim statistic should remain
clearly distinct from that official degree-grade calculation.

## Correction checklist and implemented model

The correction uses `official_regulations.py` as its sourced reference,
`regulation_credits.py` for read-time accounting, and forward data migration
`0040_official_po_credit_policies.sql`. The planner consumes the returned policy
and assessment metadata rather than a second PO catalogue. Raw achievements,
recorded grades and explicit recognition evidence remain separate from computed
credit totals. The checklist below records the original correction requirements.

Both general frameworks §19(3) retain two truncated decimals for aggregated
module grades; the special parts retain one truncated decimal for the degree
grade. Framework §3(5)–(6) excludes additional/excess credits from grades and
reserves partial excess allocation to the examination board. Such an allocation
requires explicit `recognitionEvidence.countedEcts`; it is never guessed by
prorating a record. The completion module cannot be partially excluded.

1. Correct and source the six reference profiles, retaining version/amendment
   applicability. Do not relabel the supplied JSON as authoritative or edit an
   already-applied migration as if that repaired the live database.
2. Define achievement/module identities separately from offering IDs and
   compulsory requirement slots. Collapse duplicate components/aliases, enforce
   one-of alternatives, and retain genuine repeatable, different-topic modules.
   Neither global title matching nor global course-number deduplication is safe.
3. Validate per-PO module completion and component credit limits before area
   totals. Model integrated übK as shared fulfillment, not extra credits.
4. Add the verified seminar/practical/research-project and course-level
   eligibility checks. Preserve source-backed manual/individual decisions;
   unknown evidence must be reviewed rather than guessed.
5. Separate earned, degree-counted and grade-counted credits. Exclude EXP from
   ML degree-grade weight without deleting its grades or earned credits.
6. Add official-reference regression fixtures for all six profiles: valid complete
   degrees, missing compulsory modules, alternatives, aliases/components,
   admission-prescribed BASIS, type caps and amendment-version behavior.
7. Dry-run any later D1 correction against the existing active database with a
   backup and explicit approval. Preserve user records, actual thesis/colloquium
   evidence and already-recognized achievements. No database recreation/swap and
   no automatic redistribution of historical credits are part of this audit.

Individual recognition decisions and older-PO transition cases still require
explicit evidence. This investigation verifies the central structures and the
listed discrepancies; it does not certify every catalog allocation, examination
attempt, hardship exception or personal study history.

## Official document links

Versions, hashes, official index pages and exact file names are in
[`official-po-sources.json`](official-po-sources.json).

[B-INF]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_Informatik_BSc_BT_2021_10.pdf
[B-BIO]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_Bioinformatik_BSc_BT_2021_10.pdf
[B-MEDIA]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_Medieninformatik_BSc_BT_2021_10.pdf
[B-MED]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_Medizininformatik_BSc_BT_2021_10.pdf
[M-INF]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_Informatik_MSc_BT_2021_10.pdf
[M-ML]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_BSc_MSc_MA/PO_MachLearn_MSc_BT_2021_10.pdf
[M-ML-AM1]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/MatNat/Studium_Maute_und_Thiem/SPO/PO_Aenderungssatzungen/AendS_PO_ML_MSc_BT_1AendS_2026_01.pdf
[HB-BSC]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/InfoKogni/WSI/Dokumente/Studium/Download/Modulhandbuecher/MHB_BSc_PO2021_20240502.pdf
[HB-MSC]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/InfoKogni/WSI/Dokumente/Studium/Download/Modulhandbuecher/InfoX4MasterModulhandbuch_13102023.pdf
[HB-ML]: https://uni-tuebingen.de/fileadmin/Uni_Tuebingen/Fakultaeten/InfoKogni/WSI/Dokumente/Studium/Download/Modulhandbuecher/MasterMachineLearning-Modulhandbuch_16012021.pdf
[FAQ-ML]: https://uni-tuebingen.de/en/fakultaeten/mathematisch-naturwissenschaftliche-fakultaet/fachbereiche/informatik/studium/studierende/lehre-studienorganisation/studiengaenge/machine-learning/faq/

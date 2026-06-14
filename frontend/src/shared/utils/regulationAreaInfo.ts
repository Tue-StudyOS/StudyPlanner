interface RegulationAreaInfo {
  code: string
  name: string
  description: string
}

// Static reference for the MSc Informatik (PO 2021) study areas. The codes are
// stable for the program, so the explanations live here rather than in the API.
export const REGULATION_AREA_INFO: RegulationAreaInfo[] = [
  {
    code: 'INFO-PRAK',
    name: 'Praktische Informatik',
    description: "Master's-level courses in Practical Computer Science.",
  },
  {
    code: 'INFO-TECH',
    name: 'Technische Informatik',
    description: "Master's-level courses in Technical Computer Science.",
  },
  {
    code: 'INFO-THEO',
    name: 'Theoretische Informatik',
    description: "Master's-level courses in Theoretical Computer Science.",
  },
  {
    code: 'INFO-FOKUS',
    name: 'Fokus und Erweiterungen',
    description:
      'Graded courses from the MSc programs in Bioinformatics, Media, and Medical Informatics, as well as Machine Learning.',
  },
  {
    code: 'INFO-INFO',
    name: 'Informatik',
    description:
      "Like INFO-FOKUS, plus advanced Bachelor's courses (numbered 3 and above) from the BSc programs in Bioinformatics, Media, and Medical Informatics.",
  },
  {
    code: 'INFO-BASIS',
    name: 'Grundlagen der Informatik',
    description:
      'Like INFO-INFO, plus credit for make-up courses from the compulsory area of the BSc Computer Science.',
  },
]

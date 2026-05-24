# Progress Visualization Categories

These categories drive the specialization/profile circle in the dashboard.

They are intentionally different from the regulation rule groups such as `INFO-THEO` or `ML-CS`.
Rule groups answer **where a course counts in the degree**.
Visualization categories answer **which academic profile a course strengthens**.

## Initial category set

| Code | Label | Reference ECTS | Purpose |
| --- | --- | ---: | --- |
| `SOFTWARE_ENG` | Software Engineering | 12 | architecture, software quality, programming languages, software practice |
| `THEORY` | Theory | 18 | algorithms, formal methods, cryptography, complexity |
| `MATHEMATICS` | Mathematics | 18 | linear algebra, statistics, mathematical ML foundations |
| `SYSTEMS_SECURITY` | Systems & Security | 12 | operating systems, networks, infrastructure, security |
| `DATA_DATABASES` | Data & Databases | 12 | database systems, data engineering, data-intensive computing |
| `AI_ML` | AI & Machine Learning | 18 | machine learning, neural networks, NLP, data-driven AI |
| `VISION` | Vision | 12 | computer vision, computational photography, visual perception |
| `HCI_UX` | HCI & UX | 12 | interaction techniques, human-computer interaction, usability |
| `ROBOTICS` | Robotics | 12 | robotics, autonomous systems, embodied AI |
| `INTERDISCIPLINARY` | Interdisciplinary | 12 | courses that connect Informatics with other domains |

## Interpretation

- `reference_ects` is a visualization cap, not a formal degree requirement.
- A course may contribute to multiple visualization categories.
- Regulation rule groups still stay authoritative for official degree assignment.
- The profile circle should emphasize strengths, not enforce hard graduation rules.

## Initial mapping rule

The first seed uses a hybrid approach:

1. prefer Informatics-relevant courses already present in D1
2. attach them to one or more visualization categories
3. keep the mapping table open for later regulation-specific overrides

That gives the dashboard a stable specialization view without replacing the formal examination-regulation logic.

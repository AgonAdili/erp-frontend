/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** Load the UI language's catalogue first, then the app: module-level labels are translated when their modules run. */
import { loadLanguage } from "@/i18n";

void loadLanguage().finally(() => import("./bootstrap"));

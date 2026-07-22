/* The full Lucide registry weighs megabytes — it lives in its own lazy
   chunk so the app shell stays light. Only the icon browser pulls it in,
   the first time a library grid opens. */
import { icons } from "lucide-react";
export default icons;

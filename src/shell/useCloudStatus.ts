/* Reactive view of the cloud sync/auth status. Relocated out of the old
   AccountMenu popover so both the editor top bar and the new auth overlay can
   share it. Reads from cloud.ts's pub/sub — lightweight, no editor imports. */

import { useEffect, useState } from "react";
import { onCloudStatus, cloudStatus, type CloudStatus } from "@/generator/cloud";

export function useCloudStatus(): CloudStatus {
  const [s, setS] = useState<CloudStatus>(() => cloudStatus());
  useEffect(() => onCloudStatus(setS), []);
  return s;
}

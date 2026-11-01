import { requireOptionalNativeModule } from "expo";

type UploadServiceModule = {
  start: (channelId: string, channelName: string, channelDetail: string, title: string, text: string) => boolean;
  update: (title: string, text: string, percent: number) => void;
  stop: () => void;
};

// Android seulement : sur iOS, le module n'existe pas, le système poursuit seul le PUT d'arrière-plan.
export const UploadService = requireOptionalNativeModule<UploadServiceModule>("TartanUploadService");

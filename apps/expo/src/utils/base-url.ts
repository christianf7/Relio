import Constants from "expo-constants";

const PRODUCTION_URL = "https://relio.consol8.com";

export const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (localhost) {
    return `http://${localhost}:3000`;
  }

  return PRODUCTION_URL;
};

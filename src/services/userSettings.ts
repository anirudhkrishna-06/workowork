import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY_STORAGE_KEY = 'workowork.geminiApiKey';

export async function getGeminiApiKey() {
  const key = await AsyncStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  return key?.trim() || null;
}

export async function saveGeminiApiKey(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    await AsyncStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return null;
  }

  await AsyncStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
  return trimmed;
}

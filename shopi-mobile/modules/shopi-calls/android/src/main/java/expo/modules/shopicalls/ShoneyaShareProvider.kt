package expo.modules.shopicalls

import androidx.core.content.FileProvider

/** Sous-classe dédiée : deux <provider> FileProvider de même nom entreraient en conflit (expo-sharing…). */
class ShoneyaShareProvider : FileProvider()

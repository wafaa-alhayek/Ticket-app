import 'package:flutter/material.dart';

const kGreen = Color(0xFF14532D);
const kBg = Color(0xFFF4F1EA);
const kAccent = Color(0xFFFACC15);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: kGreen,
    primary: kGreen,
    secondary: kAccent,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: kGreen,
      foregroundColor: Colors.white,
      centerTitle: true,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kGreen,
        foregroundColor: Colors.white,
        minimumSize: const Size(64, 52),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    ),
  );
}

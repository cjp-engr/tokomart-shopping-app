import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toko_mart/core/theme/theme_cubit.dart';

void main() {
  test('the app starts in dark mode', () {
    final cubit = ThemeCubit();
    addTearDown(cubit.close);
    expect(cubit.state, ThemeMode.dark);
  });

  test('toggle switches between dark and light', () {
    final cubit = ThemeCubit();
    addTearDown(cubit.close);
    cubit.toggle();
    expect(cubit.state, ThemeMode.light);
    cubit.toggle();
    expect(cubit.state, ThemeMode.dark);
  });

  test('setMode picks the given mode', () {
    final cubit = ThemeCubit();
    addTearDown(cubit.close);
    cubit.setMode(ThemeMode.light);
    expect(cubit.state, ThemeMode.light);
    cubit.setMode(ThemeMode.dark);
    expect(cubit.state, ThemeMode.dark);
  });
}

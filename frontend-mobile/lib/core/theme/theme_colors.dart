import 'package:flutter/material.dart';
import 'package:toko_mart/core/constants/app_colors.dart';

extension ThemeColors on BuildContext {
  ColorScheme get cs => Theme.of(this).colorScheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  Color get bgColor => Theme.of(this).scaffoldBackgroundColor;
  Color get surfaceColor => cs.surface;
  Color get surfaceVariantColor => cs.surfaceContainerHighest;
  Color get cardColor => cs.surfaceContainerHighest;
  Color get onSurfaceColor => cs.onSurface;
  Color get onSurfaceSecondary => cs.onSurface.withAlpha(153); // ~60% opacity
  Color get onSurfaceMuted => cs.onSurface.withAlpha(102);     // ~40% opacity
  Color get borderColor => cs.outline.withAlpha(80);
  /// Soft brand-orange fill for icon circles and badges: warm white in light mode, a faint orange glow in dark mode.
  Color get primaryTint => isDark ? AppColors.primary.withAlpha(38) : AppColors.primaryLight;
}

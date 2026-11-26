import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toko_mart/core/constants/app_colors.dart';
import 'package:toko_mart/core/theme/app_theme.dart';
import 'package:toko_mart/shared/widgets/loading_widget.dart';

void main() {
  Future<Color> circleColor(WidgetTester tester, ThemeData theme) async {
    await tester.pumpWidget(MaterialApp(
        theme: theme,
        home: const Scaffold(
            body: EmptyWidget(
                message: 'Your cart is empty',
                icon: Icons.shopping_cart_outlined))));
    await tester.pumpAndSettle();
    final circle = tester.widget<Container>(find
        .ancestor(
            of: find.byIcon(Icons.shopping_cart_outlined),
            matching: find.byType(Container))
        .first);
    return (circle.decoration as BoxDecoration).color!;
  }

  testWidgets('the empty-state circle keeps its light fill in light mode',
      (tester) async {
    expect(await circleColor(tester, AppTheme.light), AppColors.background);
  });

  testWidgets('the empty-state circle is a dark fill, not white, in dark mode',
      (tester) async {
    final color = await circleColor(tester, AppTheme.dark);
    expect(color, isNot(AppColors.background));
    expect(color.computeLuminance(), lessThan(0.1));
  });

  group('with a description (the favorites style)', () {
    Future<void> pump(WidgetTester tester, ThemeData theme) async {
      await tester.pumpWidget(MaterialApp(
          theme: theme,
          home: Scaffold(
              body: EmptyWidget(
                  message: 'Your cart is empty',
                  description: 'Add products and they will show up here.',
                  icon: Icons.shopping_cart_outlined,
                  actionLabel: 'Browse',
                  onAction: () {}))));
      await tester.pumpAndSettle();
    }

    testWidgets('shows a bold title, the description and the action',
        (tester) async {
      await pump(tester, AppTheme.dark);

      final title = tester.widget<Text>(find.text('Your cart is empty'));
      expect(title.style?.fontWeight, FontWeight.w800);
      expect(find.text('Add products and they will show up here.'),
          findsOneWidget);
      expect(find.text('Browse'), findsOneWidget);
    });

    testWidgets('has an orange icon on a soft orange circle, like favorites',
        (tester) async {
      await pump(tester, AppTheme.dark);

      final icon =
          tester.widget<Icon>(find.byIcon(Icons.shopping_cart_outlined));
      expect(icon.color, AppColors.primary);
      expect(icon.size, 44);
      final circle = tester.widget<Container>(find
          .ancestor(
              of: find.byIcon(Icons.shopping_cart_outlined),
              matching: find.byType(Container))
          .first);
      expect((circle.decoration as BoxDecoration).color,
          AppColors.primary.withAlpha(38));
    });
  });
}

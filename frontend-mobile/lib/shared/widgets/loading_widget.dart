import 'package:flutter/material.dart';
import 'package:toko_mart/core/theme/theme_colors.dart';
import 'package:toko_mart/shared/widgets/app_button.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_sizes.dart';
import '../../core/constants/app_strings.dart';

class LoadingWidget extends StatelessWidget {
  const LoadingWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.primary),
    );
  }
}

class EmptyWidget extends StatelessWidget {
  final String message;
  /// When given, the empty state uses the favorites style: a bold title, this line under it, and an orange icon on a soft orange circle.
  final String? description;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyWidget({
    super.key,
    required this.message,
    this.description,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: description == null ? 80 : 88,
              height: description == null ? 80 : 88,
              decoration: BoxDecoration(
                color: description != null
                    ? context.primaryTint
                    : context.isDark
                        ? context.surfaceVariantColor
                        : AppColors.background,
                shape: BoxShape.circle,
              ),
              child: Icon(icon,
                  size: description == null ? 40 : 44,
                  color: description == null
                      ? AppColors.textMuted
                      : AppColors.primary),
            ),
            SizedBox(height: description == null ? AppSizes.md : AppSizes.lg),
            Text(
              message,
              textAlign: TextAlign.center,
              style: description == null
                  ? TextStyle(
                      fontSize: 15,
                      color: context.onSurfaceSecondary,
                    )
                  : TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: context.onSurfaceColor,
                    ),
            ),
            if (description != null) ...[
              const SizedBox(height: AppSizes.xs),
              Text(
                description!,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: context.onSurfaceSecondary),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSizes.md),
              SizedBox(
                width: 180,
                height: AppSizes.buttonHeight,
                child: AppButton(
                  label: actionLabel!,
                  onPressed: onAction,
                ),
              )
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorWidget2 extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const ErrorWidget2({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 56, color: AppColors.danger),
            const SizedBox(height: AppSizes.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: context.onSurfaceSecondary),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSizes.md),
              TextButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text(AppStrings.retry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class PriceBadge extends StatelessWidget {
  final double price;
  const PriceBadge({super.key, required this.price});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.sm,
        vertical: AppSizes.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppSizes.radiusSm),
      ),
      child: Text(
        '\$${price.toStringAsFixed(2)}',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
    );
  }
}

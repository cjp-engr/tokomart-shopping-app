import 'package:flutter/material.dart';
import 'package:toko_mart/core/theme/theme_colors.dart';

/// What the buyer is agreeing to when the card is held. Same meaning as the web disclosure.
const String kAuthorizationDisclosure =
    'Your money is reserved now and charged when each seller starts preparing your order. '
    'Orders a seller does not accept within 24 hours are cancelled and their reservation is released. '
    'Multi-seller purchases may need a separate confirmation for each seller. '
    'Your bank may show pending charges until the reservation is released or captured.';

class AuthorizationDisclosureCard extends StatelessWidget {
  const AuthorizationDisclosureCard({super.key});

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    const amber = Color(0xFFF59E0B);
    return Container(
      key: const Key('authorization-disclosure'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? amber.withAlpha(30) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: dark ? amber.withAlpha(90) : const Color(0xFFFDE68A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_clock_outlined,
              size: 20,
              color: dark ? const Color(0xFFFCD34D) : const Color(0xFFB45309)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              kAuthorizationDisclosure,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: dark ? Colors.white70 : Colors.grey[800],
                    height: 1.4,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

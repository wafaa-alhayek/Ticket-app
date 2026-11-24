import 'package:flutter/material.dart';

import '../theme.dart';

/// Very large number (ticket / now serving), readable from a distance.
class BigNumber extends StatelessWidget {
  final String label;
  final int value;
  final bool highlight;
  const BigNumber(
      {super.key,
      required this.label,
      required this.value,
      this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: highlight ? kAccent : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kGreen, width: 2),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: const TextStyle(fontSize: 16, color: kGreen)),
        FittedBox(
          child: Text(value > 0 ? '$value' : '—',
              style: const TextStyle(
                  fontSize: 88,
                  height: 1.1,
                  fontWeight: FontWeight.w900,
                  color: kGreen)),
        ),
      ]),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  final String text;
  const ErrorBanner(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: const Color(0xFFFEE2E2),
            borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: const TextStyle(color: Color(0xFF991B1B))),
      );
}

void showSnack(BuildContext context, String msg) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

Future<bool> confirm(BuildContext context, String msg,
    {String yes = 'نعم', String no = 'لا'}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      content: Text(msg),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(no)),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text(yes)),
      ],
    ),
  );
  return r ?? false;
}

String hhmm(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

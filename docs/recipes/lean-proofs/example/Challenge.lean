/-!
# The frozen statement (the comparator "challenge")

This is the only file a person reviews and ratifies. Its SHA-256 is written in the JUnit case name the
mission row cites, so editing it changes the row's text and unbinds the ratification. Proofs here are
`sorry` on purpose: the proofs live in `Solution.lean`, which `comparator` checks against this file.
-/

namespace Shop

/-- The model: a refund never exceeds what was charged. -/
def refund (charged requested : Nat) : Nat := min charged requested

/-- The property the row rests on. -/
theorem refund_le_charge (charged requested : Nat) : refund charged requested ≤ charged := by
  sorry

/-- Sensitivity control: a stronger bound that must NOT hold, so the property above is not vacuous. -/
theorem refund_le_charge_sensitive : ¬ (∀ charged requested : Nat, refund charged requested + 1 ≤ charged) := by
  sorry

end Shop

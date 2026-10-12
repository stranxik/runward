namespace Shop

def refund (charged requested : Nat) : Nat := min charged requested

theorem refund_le_charge (charged requested : Nat) : refund charged requested ≤ charged := by
  unfold refund
  exact Nat.min_le_left charged requested

theorem refund_le_charge_sensitive : ¬ (∀ charged requested : Nat, refund charged requested + 1 ≤ charged) := by
  intro h
  have h0 := h 0 0
  simp [refund] at h0

end Shop

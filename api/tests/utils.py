def current_skill(sl):
    if sl.totalPossible <= 0:
        return 0.0
    return min(10.0, 10.0 * sl.totalEarned / sl.totalPossible)
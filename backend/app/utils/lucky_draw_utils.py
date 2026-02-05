import random
import string
from datetime import datetime
from app import db


def select_prize(lucky_draw_id):
    """
    Weighted random selection of a prize from a lucky draw.
    Only selects from prizes that are in stock.

    Args:
        lucky_draw_id: ID of the lucky draw

    Returns:
        LuckyDrawPrize object or None if no prizes available
    """
    from app.models.lucky_draw_prize import LuckyDrawPrize

    # Get all available prizes (either unlimited stock or stock > 0)
    prizes = LuckyDrawPrize.query.filter_by(
        lucky_draw_id=lucky_draw_id
    ).filter(
        db.or_(
            LuckyDrawPrize.stock_remaining > 0,
            LuckyDrawPrize.stock_remaining.is_(None)
        )
    ).all()

    if not prizes:
        return None

    # Calculate total weight
    total_weight = sum(p.probability_weight for p in prizes)

    if total_weight == 0:
        return None

    # Weighted random selection
    rand = random.random() * total_weight

    cumulative = 0
    for prize in prizes:
        cumulative += prize.probability_weight
        if rand < cumulative:
            return prize

    # Fallback (should not reach here, but return last prize just in case)
    return prizes[-1]


def generate_voucher_code(length=12):
    """
    Generate a unique voucher code.
    Format: LUCKY-XXXX-XXXX

    Args:
        length: Total length of random characters (default 12, becomes 8 after formatting)

    Returns:
        String voucher code
    """
    chars = string.ascii_uppercase + string.digits
    part1 = ''.join(random.choices(chars, k=4))
    part2 = ''.join(random.choices(chars, k=4))

    return f"LUCKY-{part1}-{part2}"


def can_user_spin_today(user_id, lucky_draw_id, max_daily_spins):
    """
    Check if user has reached daily spin limit for this draw.

    Args:
        user_id: ID of the user
        lucky_draw_id: ID of the lucky draw
        max_daily_spins: Maximum spins allowed per day (None = unlimited)

    Returns:
        Tuple (can_spin: bool, spins_today: int)
    """
    from app.models.lucky_draw_history import LuckyDrawHistory

    if max_daily_spins is None:
        return True, 0

    # Count spins today
    today = datetime.utcnow().date()
    spins_today = LuckyDrawHistory.query.filter(
        LuckyDrawHistory.user_id == user_id,
        LuckyDrawHistory.lucky_draw_id == lucky_draw_id,
        db.func.date(LuckyDrawHistory.created_at) == today
    ).count()

    can_spin = spins_today < max_daily_spins

    return can_spin, spins_today

import math


def epsilon_after_rounds(noise_multiplier, rounds, sample_rate=1.0, delta=1e-5):
    if not noise_multiplier or rounds <= 0:
        return None
    try:
        from opacus.accountants import RDPAccountant
        accountant = RDPAccountant()
        for _ in range(rounds):
            accountant.step(noise_multiplier=float(noise_multiplier), sample_rate=float(sample_rate))
        return float(accountant.get_epsilon(delta=float(delta)))
    except ImportError:
        return float(sample_rate * math.sqrt(2 * rounds * math.log(1 / delta)) / noise_multiplier + rounds * sample_rate * sample_rate / (noise_multiplier * noise_multiplier))

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import GamePerformance
from .services.skill import recompute_skill_for_category

# This file wires up skill calculation to run automatically
# whenever a GamePerformance record is created updated or deleted.
def _refresh(instance: GamePerformance):
    try:
        recompute_skill_for_category(instance.user, instance.game.category)
    except Exception:
        import logging
        logging.exception("Skill recompute failed")

@receiver(post_save, sender=GamePerformance)
def _gp_saved(sender, instance, **kwargs):
    _refresh(instance)

@receiver(post_delete, sender=GamePerformance)
def _gp_deleted(sender, instance, **kwargs):
    _refresh(instance)
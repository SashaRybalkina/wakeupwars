from django.db import migrations, models
from django.utils import timezone
from datetime import timedelta


# ---------- helpers for data migration ----------

def populate_game_routes(apps, schema_editor):
    Game = apps.get_model('api', 'Game')

    mapping = {
        'sudoku': 'Sudoku',
        'wordle': 'Wordle',
        'pattern': 'PatternGame',
    }

    for g in Game.objects.all():
        if g.route:
            continue  # already populated
        lower = g.name.lower() if g.name else ''
        route = None
        for key, screen in mapping.items():
            if key in lower:
                route = screen
                break
        if not route:
            # default detail screen
            route = 'ChallDetails'
        g.route = route
        g.save(update_fields=['route'])


def reverse_noop(apps, schema_editor):
    """No-op for backward migration (we do not unset routes)."""
    return


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_game_route'),
    ]

    operations = [
        # --- Structural fields ---
        migrations.AddField(
            model_name='sudokugamestate',
            name='join_deadline_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sudokugamestate',
            name='joins_closed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='sudokugamestate',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='wordlegamestate',
            name='join_deadline_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='wordlegamestate',
            name='joins_closed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='patternmemorizationgamestate',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='patternmemorizationgamestate',
            name='join_deadline_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='patternmemorizationgamestate',
            name='joins_closed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='sudokugameplayer',
            name='joined_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='wordlegameplayer',
            name='joined_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='patternmemorizationgameplayer',
            name='joined_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='gameperformance',
            name='auto_generated',
            field=models.BooleanField(default=False),
        ),
        # --- Data migration ---
        migrations.RunPython(populate_game_routes, reverse_noop),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tournament', '0003_remove_tournamentgame_first_created_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tournamentgame',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('ready', 'Ready'),
                    ('waiting_active_round', 'Waiting Active Round'),
                    ('0/2 players ready', '0/2 Players Ready'),
                    ('1/2 players ready', '1/2 Players Ready'),
                    ('ongoing', 'Ongoing'),
                    ('completed', 'Completed'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]

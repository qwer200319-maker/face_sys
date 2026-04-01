from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0003_faceembedding_leaverequest_overtimerecord_shift_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='camera',
            name='source_type',
            field=models.CharField(choices=[('webcam', 'Webcam'), ('rtsp', 'RTSP/IP Camera')], default='webcam', max_length=10),
        ),
        migrations.AddField(
            model_name='camera',
            name='rtsp_fps',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='camera',
            name='rtsp_quality',
            field=models.IntegerField(default=0),
        ),
    ]

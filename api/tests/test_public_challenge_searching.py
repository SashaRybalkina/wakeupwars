from datetime import datetime
import pytz
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils.timezone import now, timedelta
from rest_framework.test import APIClient
from django.utils import timezone
from api.models import Challenge, GameCategory, User, UserAvailability, SkillLevel, PublicChallengeConfiguration, PublicChallengeCategoryAssociation, AlarmSchedule, ChallengeAlarmSchedule


class GetMatchingChallengesViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", password="pass")
        self.user2 = User.objects.create_user(username="u2", password="pass2")
        self.user3 = User.objects.create_user(username="u3", password="pass3")

        self.cat1 = GameCategory.objects.create(categoryName="Word")
        self.cat2 = GameCategory.objects.create(categoryName="Math")
        self.cat3 = GameCategory.objects.create(categoryName="Pattern")

        self.skillLevel = SkillLevel.objects.create(user=self.user, category=self.cat1, totalEarned=10, 
                                                    totalPossible=100)
        self.skillLevel = SkillLevel.objects.create(user=self.user, category=self.cat2, totalEarned=50, 
                                                    totalPossible=100)
        
        self.skillLevel = SkillLevel.objects.create(user=self.user2, category=self.cat1, totalEarned=20, 
                                                    totalPossible=100)
        self.skillLevel = SkillLevel.objects.create(user=self.user2, category=self.cat2, totalEarned=60, 
                                                    totalPossible=100)
        
        self.skillLevel = SkillLevel.objects.create(user=self.user3, category=self.cat1, totalEarned=90, 
                                                    totalPossible=100)
        self.skillLevel = SkillLevel.objects.create(user=self.user3, category=self.cat2, totalEarned=80, 
                                                    totalPossible=100)
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


    def test_category_matching(self):
        # challenge 1 is Math and Word at 9:30 on monday with skill level 4
        # challenge 2 is Word at 9:30 on tuesday with skill level 8.5
        # the user searching for a challenge is willing to see Math and Word challenges
        # and their availability is monday at 9:30, tuesday at 9:30, and wednesday at 9:30

        mountain_tz = pytz.timezone("US/Mountain")
        now_mt = datetime.now(mountain_tz)
        five_minutes_ahead = now_mt + timedelta(minutes=5)
        
        today_mt = timezone.now().astimezone(mountain_tz)
        tomorrow_date = (today_mt + timedelta(days=1)).date()
        next_date = (today_mt + timedelta(days=2)).date()
        day_of_week = tomorrow_date.isoweekday()  # Monday=1, Sunday=7
        print(day_of_week)

        five_minutes_ahead_str = five_minutes_ahead.strftime("%H:%M:%S")  # 24-hour format

        avail1 = UserAvailability.objects.create(
            user=self.user,
            dayOfWeek=day_of_week,
            alarmTime="09:30:00",
            # alarmTime=five_minutes_ahead_str
        )
        avail2 = UserAvailability.objects.create(
            user=self.user,
            dayOfWeek=day_of_week+1,
            alarmTime="09:30:00",
            # alarmTime=five_minutes_ahead_str
        )
        avail3 = UserAvailability.objects.create(
            user=self.user,
            dayOfWeek=day_of_week+3,
            alarmTime="09:30:00",
            # alarmTime=five_minutes_ahead_str
        )



        alarm1 = AlarmSchedule.objects.create(
            uID = self.user2,
            dayOfWeek = day_of_week, # Integer field to store day of the week (1-7)
            alarmTime = "09:32:00"
        )
        alarm2 = AlarmSchedule.objects.create(
            uID = self.user3,
            dayOfWeek = day_of_week+1, # Integer field to store day of the week (1-7)
            alarmTime = "09:32:00"
        )


        # today = timezone.now().date()


        print("tomorrow:")
        print(tomorrow_date)
        c1 = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user2,
            isPublic    = True,
            isPending   = True,
            startDate   = tomorrow_date,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 1',
            isCompleted = False,
            daysCompleted = 0
        )
        config1 = PublicChallengeConfiguration.objects.create(
            challenge=c1,
            averageSkillLevel=4.00,
            isMultiplayer=True
        )
        ca1 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c1,
            category=self.cat1
        )
        ca11 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c1,
            category=self.cat2
        )
        cas1 = ChallengeAlarmSchedule.objects.create(
            challenge=c1,
            alarm_schedule=alarm1
        )




        c2 = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user3,
            isPublic    = True,
            isPending   = True,
            startDate   = next_date,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 2',
            isCompleted = False,
            daysCompleted = 0
        )
        config2 = PublicChallengeConfiguration.objects.create(
            challenge=c2,
            averageSkillLevel=8.50,
            isMultiplayer=True
        )
        ca2 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c2,
            category=self.cat1
        )
        cas2 = ChallengeAlarmSchedule.objects.create(
            challenge=c2,
            alarm_schedule=alarm2
        )



        c3 = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user3,
            isPublic    = True,
            isPending   = True,
            startDate   = next_date,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 3',
            isCompleted = False,
            daysCompleted = 0
        )
        config3 = PublicChallengeConfiguration.objects.create(
            challenge=c3,
            averageSkillLevel=8.50,
            isMultiplayer=True
        )
        ca3 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c3,
            category=self.cat1
        )
        ca33 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c3,
            category=self.cat2
        )
        ca333 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c3,
            category=self.cat3
        )
        cas3 = ChallengeAlarmSchedule.objects.create(
            challenge=c3,
            alarm_schedule=alarm2
        )




        url = f"/api/get-matching-challenges/{self.user.id}/{self.cat1.id},{self.cat2.id}/Multiplayer/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        print(data)
        self.assertIn("matches", data)
        self.assertEqual(len(data["matches"]), 2)  # both c1 and c2 should appear
        self.assertEqual(data["matches"][0]["summary"]["name"], "Chall 1")  # lowest distance should come first

        distances = [m["distance"] for m in data["matches"]]
        self.assertLessEqual(distances[0], distances[1])




    def test_excludes_based_on_start_datetime(self):
        # challenge 1 is Math and Word at 9:30 on monday with skill level 4
        # challenge 2 is Word at 9:30 on tuesday with skill level 8.5
        # the user searching for a challenge is willing to see Math and Word challenges
        # and their availability is monday at 9:30, tuesday at 9:30, and wednesday at 9:30

        mountain_tz = pytz.timezone("US/Mountain")
        now_mt = datetime.now(mountain_tz)
        # five_minutes_ahead = now_mt + timedelta(minutes=5)
        
        today_mt = timezone.now().astimezone(mountain_tz)
        tomorrow_date = (today_mt + timedelta(days=1)).date()
        next_date = (today_mt + timedelta(days=2)).date()
        day_of_week = tomorrow_date.isoweekday()  # Monday=1, Sunday=7
        print(day_of_week)

        # five_minutes_ahead_str = five_minutes_ahead.strftime("%H:%M:%S")  # 24-hour format

        avail1 = UserAvailability.objects.create(
            user=self.user,
            dayOfWeek = today_mt.isoweekday(), # Integer field to store day of the week (1-7)
            alarmTime = (now_mt + timedelta(minutes=5)).strftime("%H:%M:%S")
        )
        avail2 = UserAvailability.objects.create(
            user=self.user,
            dayOfWeek = today_mt.isoweekday(), # Integer field to store day of the week (1-7)
            alarmTime = (now_mt - timedelta(minutes=1)).strftime("%H:%M:%S")
        )



        alarm1 = AlarmSchedule.objects.create(
            uID = self.user2,
            dayOfWeek = today_mt.isoweekday(), # Integer field to store day of the week (1-7)
            alarmTime = (now_mt + timedelta(minutes=6)).strftime("%H:%M:%S")
        )
        alarm2 = AlarmSchedule.objects.create(
            uID = self.user3,
            dayOfWeek = today_mt.isoweekday(), # Integer field to store day of the week (1-7)
            alarmTime = (now_mt - timedelta(minutes=1)).strftime("%H:%M:%S")
        )

        c1 = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user2,
            isPublic    = True,
            isPending   = True,
            startDate   = today_mt,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 1',
            isCompleted = False,
            daysCompleted = 0
        )
        config1 = PublicChallengeConfiguration.objects.create(
            challenge=c1,
            averageSkillLevel=4.00,
            isMultiplayer=True
        )
        ca1 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c1,
            category=self.cat1
        )
        ca11 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c1,
            category=self.cat2
        )
        cas1 = ChallengeAlarmSchedule.objects.create(
            challenge=c1,
            alarm_schedule=alarm1
        )




        c2 = Challenge.objects.create(
            groupID     = None,
            initiator   = self.user3,
            isPublic    = True,
            isPending   = True,
            startDate   = today_mt,
            endDate     = None,
            totalDays   = 30,
            name        = 'Chall 2',
            isCompleted = False,
            daysCompleted = 0
        )
        config2 = PublicChallengeConfiguration.objects.create(
            challenge=c2,
            averageSkillLevel=8.50,
            isMultiplayer=True
        )
        ca2 = PublicChallengeCategoryAssociation.objects.create(
            challenge=c2,
            category=self.cat1
        )
        cas2 = ChallengeAlarmSchedule.objects.create(
            challenge=c2,
            alarm_schedule=alarm2
        )


        url = f"/api/get-matching-challenges/{self.user.id}/{self.cat1.id},{self.cat2.id}/Multiplayer/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        print(data)
        self.assertIn("matches", data)
        self.assertEqual(len(data["matches"]), 1)  # only c1 should appear
        self.assertEqual(data["matches"][0]["summary"]["name"], "Chall 1")



    # def test_excludes_based_on_start_date(self):
    #     # challenge 1 is Math and Word at 9:30 on monday with skill level 4
    #     # challenge 2 is Word at 9:30 on tuesday with skill level 8.5
    #     # the user searching for a challenge is willing to see Math and Word challenges
    #     # and their availability is monday at 9:30, tuesday at 9:30, and wednesday at 9:30

    #     avail1 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=1,
    #         alarmTime="09:30:00"
    #     )
    #     avail2 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=2,
    #         alarmTime="09:30:00"
    #     )
    #     avail3 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=3,
    #         alarmTime="09:30:00"
    #     )



    #     alarm1 = AlarmSchedule.objects.create(
    #         uID = self.user2,
    #         dayOfWeek = 1, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:32:00"
    #     )
    #     alarm2 = AlarmSchedule.objects.create(
    #         uID = self.user3,
    #         dayOfWeek = 2, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:32:00"
    #     )


    #     today = timezone.now().date()
    #     c1 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user2,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = today,
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 1',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config1 = PublicChallengeConfiguration.objects.create(
    #         challenge=c1,
    #         averageSkillLevel=4.00,
    #         isMultiplayer=True
    #     )
    #     ca1 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat1
    #     )
    #     ca11 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat2
    #     )
    #     cas1 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c1,
    #         alarm_schedule=alarm1
    #     )




    #     c2 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user3,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = timezone.now().date() - timedelta(days=1),
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 2',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config2 = PublicChallengeConfiguration.objects.create(
    #         challenge=c2,
    #         averageSkillLevel=8.50,
    #         isMultiplayer=True
    #     )
    #     ca2 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c2,
    #         category=self.cat1
    #     )
    #     cas2 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c2,
    #         alarm_schedule=alarm2
    #     )





    #     url = f"/api/get-matching-challenges/{self.user.id}/{self.cat1.id},{self.cat2.id}/Multiplayer/"
    #     response = self.client.get(url)

    #     self.assertEqual(response.status_code, status.HTTP_200_OK)
    #     data = response.json()

    #     self.assertIn("matches", data)
    #     self.assertEqual(len(data["matches"]), 1)  # only c1 should appear
    #     self.assertEqual(data["matches"][0]["summary"]["name"], "Chall 1") 



    # def test_excludes_based_on_categories(self):
    #     # challenge 1 is Math and Word at 9:30 on monday with skill level 4
    #     # challenge 2 is Word at 9:44 on tuesday with skill level 8.5
    #     # the user searching for a challenge is willing to see Word challenges
    #     # and their availability is monday at 9:30, tuesday at 9:30

    #     avail1 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=1,
    #         alarmTime="09:30:00"
    #     )
    #     avail2 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=2,
    #         alarmTime="09:30:00"
    #     )


    #     alarm1 = AlarmSchedule.objects.create(
    #         uID = self.user2,
    #         dayOfWeek = 1, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:30:00"
    #     )
    #     alarm2 = AlarmSchedule.objects.create(
    #         uID = self.user3,
    #         dayOfWeek = 2, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:44:00"
    #     )


    #     today = timezone.now().date()
    #     c1 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user2,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = today,
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 1',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config1 = PublicChallengeConfiguration.objects.create(
    #         challenge=c1,
    #         averageSkillLevel=4.00,
    #         isMultiplayer=True
    #     )
    #     ca1 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat1
    #     )
    #     ca11 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat2
    #     )
    #     cas1 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c1,
    #         alarm_schedule=alarm1
    #     )




    #     c2 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user3,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = today,
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 2',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config2 = PublicChallengeConfiguration.objects.create(
    #         challenge=c2,
    #         averageSkillLevel=8.50,
    #         isMultiplayer=True
    #     )
    #     ca2 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c2,
    #         category=self.cat1
    #     )
    #     cas2 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c2,
    #         alarm_schedule=alarm2
    #     )




    #     url = f"/api/get-matching-challenges/{self.user.id}/{self.cat1.id}/Multiplayer/"
    #     response = self.client.get(url)

    #     self.assertEqual(response.status_code, status.HTTP_200_OK)
    #     data = response.json()

    #     self.assertIn("matches", data)
    #     self.assertEqual(len(data["matches"]), 1) 
    #     self.assertEqual(data["matches"][0]["summary"]["name"], "Chall 2")  # only c2 should appear



    # def test_excludes_based_on_availability(self):
    #     # challenge 1 is Math and Word at 9:30 on monday with skill level 4
    #     # challenge 2 is Word at 9:44 on tuesday with skill level 8.5
    #     # the user searching for a challenge is willing to see Word challenges
    #     # and their availability is monday at 9:30, tuesday at 9:45

    #     avail1 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=1,
    #         alarmTime="09:30:00"
    #     )
    #     avail2 = UserAvailability.objects.create(
    #         user=self.user,
    #         dayOfWeek=2,
    #         alarmTime="09:30:00"
    #     )


    #     alarm1 = AlarmSchedule.objects.create(
    #         uID = self.user2,
    #         dayOfWeek = 1, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:30:00"
    #     )
    #     alarm2 = AlarmSchedule.objects.create(
    #         uID = self.user3,
    #         dayOfWeek = 2, # Integer field to store day of the week (1-7)
    #         alarmTime = "09:45:00"
    #     )


    #     today = timezone.now().date()
    #     c1 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user2,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = today,
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 1',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config1 = PublicChallengeConfiguration.objects.create(
    #         challenge=c1,
    #         averageSkillLevel=4.00,
    #         isMultiplayer=True
    #     )
    #     ca1 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat1
    #     )
    #     ca11 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c1,
    #         category=self.cat2
    #     )
    #     cas1 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c1,
    #         alarm_schedule=alarm1
    #     )




    #     c2 = Challenge.objects.create(
    #         groupID     = None,
    #         initiator   = self.user3,
    #         isPublic    = True,
    #         isPending   = True,
    #         startDate   = today,
    #         endDate     = None,
    #         totalDays   = 30,
    #         name        = 'Chall 2',
    #         isCompleted = False,
    #         daysCompleted = 0
    #     )
    #     config2 = PublicChallengeConfiguration.objects.create(
    #         challenge=c2,
    #         averageSkillLevel=8.50,
    #         isMultiplayer=True
    #     )
    #     ca2 = PublicChallengeCategoryAssociation.objects.create(
    #         challenge=c2,
    #         category=self.cat1
    #     )
    #     cas2 = ChallengeAlarmSchedule.objects.create(
    #         challenge=c2,
    #         alarm_schedule=alarm2
    #     )




    #     url = f"/api/get-matching-challenges/{self.user.id}/{self.cat1.id}/Multiplayer/"
    #     response = self.client.get(url)

    #     self.assertEqual(response.status_code, status.HTTP_200_OK)
    #     data = response.json()

    #     self.assertIn("matches", data)
    #     print(data["matches"])
    #     self.assertEqual(len(data["matches"]), 0)




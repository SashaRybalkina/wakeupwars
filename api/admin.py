# Register your models here.
# api/admin.py
from django.contrib import admin
from .models import RewardSetting, ExternalHandle, Obligation, Payment

@admin.register(RewardSetting)
class RSAdmin(admin.ModelAdmin):
    list_display = ('challenge','type','amount','note')

@admin.register(ExternalHandle)
class EHAdmin(admin.ModelAdmin):
    list_display = ('user','provider','handle','created_at')
    search_fields = ('user__username','handle')

@admin.register(Obligation)
class ObligationAdmin(admin.ModelAdmin):
    list_display = ('challenge','payer','payee','amount','status','due_at','agreement_accepted')
    list_filter = ('status',)

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('obligation','method','provider','amount','status','payer_marked_at','winner_confirmed_at')
    list_filter = ('status','provider','method')


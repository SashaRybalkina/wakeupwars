"""
/**
 * @file admin.py
 * @description Admin registrations and configurations for rewards,
 * external handles, obligations, and payments.
 */
"""

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
    list_display  = ('challenge', 'payer', 'payee', 'amount', 'status', 'due_at')
    list_filter   = ('status',)
    search_fields = ('challenge__name', 'payer__username', 'payee__username')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ('obligation', 'method', 'provider', 'amount', 'status')
    list_filter   = ('status', 'provider', 'method')
    search_fields = ('obligation__challenge__name', 'obligation__payer__username')

from rest_framework import serializers
from .models import *

class FinanceConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceConcept
        fields = ['id','name','code','default_amount','active']

class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id','name','bank','number','currency']

class BankMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankMovement
        fields = ['id','account','date','description','amount','external_ref','reconciled']

class AccountEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountEntry
        fields = ['id','subject_type','subject_id','concept','date','amount','method','ref','meta']

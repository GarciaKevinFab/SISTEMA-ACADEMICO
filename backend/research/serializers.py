from rest_framework import serializers
from .models import *

class LineSerializer(serializers.ModelSerializer):
    class Meta: model = ResearchLine; fields = ['id','name']

class AdvisorSerializer(serializers.ModelSerializer):
    class Meta: model = Advisor; fields = ['id','full_name','email']

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id','title','line','advisor','summary','status','start_date','end_date','meta','created_at','updated_at']

class ScheduleItemSerializer(serializers.ModelSerializer):
    class Meta: model = ScheduleItem; fields = ['id','name','start','end','progress','meta']

class DeliverableSerializer(serializers.ModelSerializer):
    class Meta: model = Deliverable; fields = ['id','name','description','due_date','status','file','meta','updated_at']

class EvaluationSerializer(serializers.ModelSerializer):
    class Meta: model = Evaluation; fields = ['id','rubric','created_at']

class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta: model = TeamMember; fields = ['id','full_name','role','dedication_pct','email','orcid','meta']

class BudgetItemSerializer(serializers.ModelSerializer):
    class Meta: model = BudgetItem; fields = ['id','category','concept','amount','executed','receipt','meta','created_at']

class EthicsIPSerializer(serializers.ModelSerializer):
    class Meta: model = EthicsIP; fields = ['id','ethics','ethics_doc','ip','ip_doc']

class PublicationSerializer(serializers.ModelSerializer):
    class Meta: model = Publication; fields = ['id','type','title','journal','year','doi','link','indexed','meta']

class CallSerializer(serializers.ModelSerializer):
    class Meta: model = Call; fields = ['id','code','title','start_date','end_date','budget_cap','description']

class ProposalSerializer(serializers.ModelSerializer):
    class Meta: model = Proposal; fields = ['id','call','title','line','team','summary','budget','status','created_at']

class ProposalReviewSerializer(serializers.ModelSerializer):
    class Meta: model = ProposalReview; fields = ['id','reviewer_id','rubric','created_at']

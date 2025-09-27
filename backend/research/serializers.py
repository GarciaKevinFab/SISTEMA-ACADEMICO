from rest_framework import serializers
from .models import *

# --- Catálogos ---
class LineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchLine
        fields = ['id', 'name']

class AdvisorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Advisor
        fields = ['id', 'full_name', 'email']

# --- Projects con alias/metadatos/estados ---
_UI_TO_DB_STATUS = {
    "IN_REVIEW": "IN_REVIEW",
    "APPROVED": "APPROVED",
    "REJECTED": "REJECTED",
    "IN_PROGRESS": "RUNNING",
    "ON_HOLD": "ON_HOLD",
    "COMPLETED": "FINISHED",
    "DRAFT": "DRAFT",
}
_DB_TO_UI_STATUS = {v: k for k, v in _UI_TO_DB_STATUS.items()}

class ProjectSerializer(serializers.ModelSerializer):
    # *_id write-only SIN source (evita dicts anidados en validated_data)
    line_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    advisor_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    # read-only “decorations”
    line_name = serializers.CharField(source="line.name", read_only=True)
    advisor_name = serializers.CharField(source="advisor.full_name", read_only=True)

    # alias desde meta
    code = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    keywords = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id','title','line','advisor',
            'line_id','advisor_id','line_name','advisor_name',
            'summary','status','start_date','end_date','meta','created_at','updated_at',
            'code','budget','keywords',
        ]
        extra_kwargs = {
            'line': {'required': False, 'allow_null': True},
            'advisor': {'required': False, 'allow_null': True},
        }

    # getters alias
    def get_code(self, obj):     return (obj.meta or {}).get('code')
    def get_budget(self, obj):   return (obj.meta or {}).get('budget', 0)
    def get_keywords(self, obj): return (obj.meta or {}).get('keywords', "")

    # normaliza entrada y estados
    def to_internal_value(self, data):
        d = super().to_internal_value(data)

        # status UI -> DB
        in_status = (data.get('status') or '').upper()
        if in_status in _UI_TO_DB_STATUS:
            d['status'] = _UI_TO_DB_STATUS[in_status]

        # Resolver FKs por *_id
        lid = data.get('line_id', None)
        aid = data.get('advisor_id', None)
        if lid is not None:
            d['line'] = ResearchLine.objects.filter(pk=lid).first()
        if aid is not None:
            d['advisor'] = Advisor.objects.filter(pk=aid).first()

        # merge meta aliases
        meta = dict(getattr(self.instance, 'meta', {}) or {})
        for k in ('code','budget','keywords'):
            if k in data:
                meta[k] = data.get(k)
        d['meta'] = meta
        return d

    # estados DB -> UI
    def to_representation(self, obj):
        r = super().to_representation(obj)
        r['status'] = _DB_TO_UI_STATUS.get(obj.status, obj.status)
        # asegura *_id en la respuesta
        r['line_id'] = obj.line_id
        r['advisor_id'] = obj.advisor_id
        return r

# --- Schedule ---
class ScheduleItemUISerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='name')
    due_date = serializers.DateField(source='end', allow_null=True, required=False)
    responsible = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleItem
        fields = ['id','title','due_date','responsible','status','progress']

    def get_responsible(self, obj): return (obj.meta or {}).get('responsible')
    def get_status(self, obj):      return (obj.meta or {}).get('status', 'PLANNED')

# --- Deliverables ---
class DeliverableSerializer(serializers.ModelSerializer):
    link = serializers.SerializerMethodField()
    class Meta:
        model = Deliverable
        fields = ['id','name','description','due_date','status','file','meta','updated_at','link']
    def get_link(self, obj): return (obj.meta or {}).get('link', '')

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

# --- Calls / Proposals / Reviews ---
class CallSerializer(serializers.ModelSerializer):
    class Meta: model = Call; fields = ['id','code','title','start_date','end_date','budget_cap','description']

class ProposalSerializer(serializers.ModelSerializer):
    line_name = serializers.CharField(source='line.name', read_only=True)
    class Meta: model = Proposal; fields = ['id','call','title','line','line_name','team','summary','budget','status','created_at']

class ProposalReviewSerializer(serializers.ModelSerializer):
    class Meta: model = ProposalReview; fields = ['id','reviewer_id','rubric','created_at']

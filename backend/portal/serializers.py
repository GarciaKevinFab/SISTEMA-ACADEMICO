from rest_framework import serializers
from .models import *

class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = ['id','title','slug','content','is_published','meta','created_at','updated_at']

class NewsSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    class Meta:
        model = NewsItem
        fields = ['id','title','slug','summary','body','cover','cover_url','published','publish_at','tags','created_at','updated_at']
    def get_cover_url(self, obj):
        try: return obj.cover.url
        except: return None

class DocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = Document
        fields = ['id','title','category','file','url','published','meta','created_at','updated_at']
    def get_url(self, obj):
        try: return obj.file.url
        except: return None

class InboxItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InboxItem
        fields = ['id','type','data','status','created_at']

class AdmissionCallSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = AdmissionCall
        fields = [
            "id","title","description","start_date","end_date",
            "published","file","url","created_at","updated_at"
        ]

    def get_url(self, obj):
        try:
            return obj.file.url
        except:
            return None

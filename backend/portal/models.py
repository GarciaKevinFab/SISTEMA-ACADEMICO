# Create your models here.
from django.db import models
from django.utils.text import slugify

class Page(models.Model):
    title = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    content = models.TextField(blank=True, default="")        # HTML/Markdown
    is_published = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:180]
        return super().save(*args, **kwargs)

class NewsItem(models.Model):
    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    summary = models.TextField(blank=True, default="")
    body = models.TextField(blank=True, default="")
    cover = models.ImageField(upload_to='portal/news/', null=True, blank=True)
    published = models.BooleanField(default=False)
    publish_at = models.DateTimeField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:200]
        return super().save(*args, **kwargs)

class Document(models.Model):
    title = models.CharField(max_length=180)
    category = models.CharField(max_length=80, blank=True, default="")
    file = models.FileField(upload_to='portal/docs/')
    published = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

INBOX_TYPES = (("CONTACT","CONTACT"), ("PREINSCRIPTION","PREINSCRIPTION"))
INBOX_STATUS = (("NEW","NEW"), ("REVIEWED","REVIEWED"), ("ARCHIVED","ARCHIVED"))

class InboxItem(models.Model):
    type = models.CharField(max_length=20, choices=INBOX_TYPES)
    data = models.JSONField(default=dict, blank=True)  # payload completo
    status = models.CharField(max_length=12, choices=INBOX_STATUS, default="NEW")
    created_at = models.DateTimeField(auto_now_add=True)

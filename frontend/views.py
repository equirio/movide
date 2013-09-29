from django.shortcuts import render, render_to_response, redirect
from django.conf import settings
import logging
from django.template import RequestContext
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponse
from api.models import Classgroup, RatingNotification, MessageNotification, StudentClassSettings, ClassSettings
from rest_framework.response import Response
from rest_framework import status
from api.forms import StudentClassSettingsForm, ClassSettingsForm
from django.contrib.auth.models import User
import json
from allauth.account.views import LoginView, SignupView

log=logging.getLogger(__name__)

def mock_login_form(request):
    login_view = LoginView()
    login_view.request = request
    login_view.template_name = "account/login_short.html"
    return login_view.get(request).render().content

def mock_signup_form(request):
    signup_view = SignupView()
    signup_view.request = request
    signup_view.template_name = "account/signup_short.html"
    return signup_view.get(request).render().content


def get_modals(request):
    return {
        'login': mock_login_form(request),
        'signup': mock_signup_form(request)
    }

@login_required()
def dashboard(request):
    return render_to_response("dashboard/main.html", context_instance=RequestContext(request))

def index(request):
    return render_to_response("index.html", get_modals(request),
                              context_instance=RequestContext(request))

def about(request):
    return render_to_response("about.html", get_modals(request),
                              context_instance=RequestContext(request))

@login_required()
def verify_code(request):
    code = request.POST.get('code')
    class_name = request.POST.get("class_name")
    user = request.user
    if isinstance(code, list):
        code = code[0]
    if isinstance(class_name, list):
        class_name = class_name[0]

    if code is None:
        return HttpResponse(status=400)
    if class_name is None:
        return HttpResponse(status=400)

    try:
        cg = Classgroup.objects.get(name=class_name)
    except Classgroup.DoesNotExist:
        raise Http404

    if not cg.class_settings.allow_signups:
        return HttpResponse(status=400)

    if cg.class_settings.access_key == code:
        user.classgroups.add(cg)
        user.save()
        return HttpResponse(status=200)
    else:
        return HttpResponse(status=400)

def uncleared_notification_count(user, classgroup):
    rating_count = RatingNotification.objects.filter(receiving_user=user, receiving_message__classgroup=classgroup, cleared=False).count()
    message_count = MessageNotification.objects.filter(receiving_user=user, receiving_message__classgroup=classgroup, cleared=False).count()
    return rating_count + message_count

def verify_settings(request, classgroup):
    if classgroup is None:
        raise Http404

    try:
        cg = Classgroup.objects.get(name=classgroup)
    except Classgroup.DoesNotExist:
        raise Http404

    if request.user.classgroups.filter(name=classgroup).count() == 0 and request.user != cg.owner:
        raise Http404

    return cg

@login_required()
def student_settings(request, classgroup):
    cg = verify_settings(request, classgroup)

    student_settings, created = StudentClassSettings.objects.get_or_create(user=request.user, classgroup=cg)

    if request.method == 'POST':
        form = StudentClassSettingsForm(request.POST, instance=student_settings)
        if form.is_valid():
            form.save()
    else:
        form = StudentClassSettingsForm(instance=student_settings)

    return render(request, 'dashboard/settings_form.html', {
        'form': form,
        'action_link': student_settings.link(),
        'form_id': 'student-settings-form',
        'save_button_value': 'Save Preferences'
        })

@login_required()
def class_settings(request, classgroup):
    cg = verify_settings(request, classgroup)

    if request.user != cg.owner:
        raise Http404

    class_settings = ClassSettings.objects.get(classgroup=cg)

    if request.method == 'POST':
        form = ClassSettingsForm(request.POST, instance=class_settings)
        if form.is_valid():
            form.save()
    else:
        form = ClassSettingsForm(instance=class_settings)

    return render(request, 'dashboard/settings_form.html', {
        'form': form,
        'action_link': class_settings.link(),
        'form_id': 'class-settings-form',
        'save_button_value': 'Save Class Settings',
    })

VALID_ACTIVE_PAGES = ['messages', 'stats', 'users', 'notifications', 'settings', 'home', 'resources']
@login_required()
def classview(request, classgroup, **kwargs):
    active_page = kwargs.get('active_page', 'home')
    if active_page not in VALID_ACTIVE_PAGES:
        raise Http404

    try:
        cg = Classgroup.objects.get(name=classgroup)
    except Classgroup.DoesNotExist:
        raise Http404

    is_owner = str(cg.owner == request.user).lower()
    template_vars = {
        'name': cg.name,
        'display_name': cg.display_name,
        'link': cg.link(),
        'is_owner': is_owner,
        'access_key': cg.class_settings.access_key,
        'active_page': active_page,
        'notification_count': uncleared_notification_count(request.user, cg),
        'class_owner': cg.owner.username,
        'class_api_link': cg.api_link(),
        'autocomplete_list': json.dumps(cg.autocomplete_list()),
        }

    if request.user.classgroups.filter(name=classgroup).count() == 0:
        if cg.class_settings.allow_signups:
            return render_to_response("enter_class_code.html", template_vars, context_instance=RequestContext(request))
        else:
            return render_to_response("class_signup_closed.html", template_vars, context_instance=RequestContext(request))

    return render_to_response("dashboard/classview.html", template_vars,
           context_instance=RequestContext(request)
    )

@login_required()
def add_user(request, classgroup):
    # Disable this functionality for now until privacy issues are sorted out.
    raise Http404
    if request.method != 'POST':
        raise Http404

    cg = verify_settings(request, classgroup)

    if request.user != cg.owner:
        raise Http404

    username = request.POST.get('username')
    user = User.objects.get(username=username)
    user.classgroups.add(cg)

    user.save()

    return HttpResponse(status=200)

@login_required()
def remove_user(request, classgroup):
    if request.method != 'POST':
        raise Http404

    cg = verify_settings(request, classgroup)

    if request.user != cg.owner:
        raise Http404

    username = request.POST.get('username')
    user = User.objects.get(username=username)
    user.classgroups.remove(cg)
    user.save()

    return HttpResponse(status=200)

@login_required()
def autocomplete_names(request, classgroup):
    if request.method != 'GET':
        raise Http404

    cg = verify_settings(request, classgroup)

    return HttpResponse(json.dumps(cg.autocomplete_list()), status=200)





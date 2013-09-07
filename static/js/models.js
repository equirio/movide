$(document).ready(function() {
    var CSRF_TOKEN = $('meta[name="csrf-token"]').attr('content');
    var oldSync = Backbone.sync;
    Backbone.sync = function(method, model, options){
        options.beforeSend = function(xhr){
            xhr.setRequestHeader('X-CSRFToken', CSRF_TOKEN);
        };
        return oldSync(method, model, options);
    };

    function capitalize(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function endsWith(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }

    function trim1 (str) {
        return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    var Tweet = Backbone.Model.extend({
        idAttribute: 'pk'
    });

    var User = Backbone.Model.extend({
        idAttribute: 'pk'
    });

    var Tweets = Backbone.Collection.extend({
        model: Tweet,
        url: '/api/tweets/'
    });

    var Tag = Backbone.Model.extend({
        idAttribute: 'pk',
        url: function () {
            return '/api/tags/' + this.id;
        },
        methodUrl: {
            'create': '/api/tags/'
        },
        sync: function(method, model, options) {
            if (model.methodUrl && model.methodUrl[method.toLowerCase()]) {
                options = options || {};
                options.url = model.methodUrl[method.toLowerCase()];
            }
            Backbone.sync(method, model, options);
        }
    });

    var Tags = Backbone.Collection.extend({
        model: Tag,
        url: '/api/tags/'
    });

    var Users = Backbone.Collection.extend({
        model: User,
        url: '/api/users/'
    });

    var UserView = Backbone.View.extend({
        tagName: "div",
        className: "users",
        template_name: "#userTemplate",
        events: {
        },
        initialize: function(){
            _.bindAll(this, 'render'); // every function that uses 'this' as the current object should be in here
            this.model.bind('change', this.render);
            this.model.bind('remove', this.unrender);
        },
        get_model_json: function(){
            var model_json = this.model.toJSON();
            model_json.modified = model_json.modified.split("T")[0];
            return model_json;
        },
        render: function () {
            var tmpl = _.template($(this.template_name).html());
            var model_json = this.get_model_json();
            var model_html = tmpl(model_json);

            $(this.el).html(model_html);
            return this;
        },
        destroy: function() {
            this.model.trigger('destroy', this.model, this.model.collection, {});
        },
        remove_el: function(){
            $(this.el).remove();
        }
    });

    var UsersView = Backbone.View.extend({
        el: $("#user-table"),
        collection_class : Users,
        view_class: UserView,
        initialize: function () {
            _.bindAll(this, 'render', 'renderTag', 'renderNone', 'refresh');
            this.collection = new this.collection_class();
            this.collection.fetch({async:false});
        },
        render_table: function(){
            this.render();
        },
        render: function () {
            var that = this;
            _.each(this.collection.models, function (item) {
                that.renderTag(item);
            }, this);
        },
        renderTag: function (item) {
            var tagView = new this.view_class({
                model: item
            });
            $(this.el).append(tagView.render().el);
        },
        refresh: function(){
            this.collection.fetch({async:false});
            $(this.el).empty();
            this.render_dash();
        }
    });

    var TagView = Backbone.View.extend({
        tagName: "div",
        className: "tags",
        template_name: "#tagTemplate",
        events: {
        },
        initialize: function(){
            _.bindAll(this, 'render'); // every function that uses 'this' as the current object should be in here
            this.model.bind('change', this.render);
            this.model.bind('remove', this.unrender);
        },
        get_model_json: function(){
            var model_json = this.model.toJSON();
            model_json.modified = model_json.modified.split("T")[0];
            return model_json;
        },
        render: function () {
            var tmpl = _.template($(this.template_name).html());
            var model_json = this.get_model_json();
            var model_html = tmpl(model_json);

            $(this.el).html(model_html);
            return this;
        },
        destroy: function() {
            this.model.trigger('destroy', this.model, this.model.collection, {});
        },
        remove_el: function(){
            $(this.el).remove();
        }
    });

    var TagsView = Backbone.View.extend({
        el: $("#tags"),
        collection_class : Tags,
        view_class: TagView,
        initialize: function () {
            _.bindAll(this, 'render', 'renderTag', 'renderNone', 'refresh');
            this.collection = new this.collection_class();
            this.collection.fetch({async:false});
        },
        render_dash: function(){
            if(this.collection.length > 0){
                this.renderUsage();
                this.render();
            } else{
                this.renderNone();
            }
        },
        render: function () {
            var that = this;
            _.each(this.collection.models, function (item) {
                that.renderTag(item);
            }, this);
        },
        renderUsage: function(){
            var use_tag_prompt = $("#useTagPromptTemplate").html();
            $(this.el).html(use_tag_prompt);
        },
        renderNone: function() {
            var add_tag_prompt = $("#addTagPromptTemplate").html();
            $(this.el).html(add_tag_prompt);
        },
        renderTag: function (item) {
            var tagView = new this.view_class({
                model: item
            });
            $(this.el).append(tagView.render().el);
        },
        refresh: function(){
            this.collection.fetch({async:false});
            $(this.el).empty();
            this.render_dash();
        }
    });

    var TagSidebarView = TagView.extend({
        tagName: "li",
        className: "tag-name",
        template_name: "#sidebarItemTemplate"
    });

    var TagsSidebarView = TagsView.extend({
        el: $("#tag-sidebar"),
        view_class: TagSidebarView,
        events: {
            'click #refresh-sidebar': 'refresh',
            'click .tag-name' : 'render_tag_name'
        },
        render_sidebar: function(){
            $('.tag-name', this.el).remove();
            var that = this;
            _.each(this.collection.models, function (item) {
                that.renderTag(item);
            }, this);
        },
        refresh: function(){
            this.collection.fetch({async:false});
            this.render_sidebar();
        }
    });

    var TagSidebarDetailView = TagView.extend({
        el: $("#dashboard-content"),
        collection_class : Users,
        view_class: UsersView,
        initialize: function () {
            _.bindAll(this, 'render', 'renderTag', 'renderNone', 'refresh');
            this.collection = new this.collection_class();
            this.collection.fetch({async:false});
        },
        render_dash: function(){
            if(this.collection.length > 0){
                this.renderUsage();
                this.render();
            } else{
                this.renderNone();
            }
        },
        render: function () {
            var that = this;
            _.each(this.collection.models, function (item) {
                that.renderTag(item);
            }, this);
        },
        renderUsage: function(){
            var use_tag_prompt = $("#useTagPromptTemplate").html();
            $(this.el).html(use_tag_prompt);
        },
        renderNone: function() {
            var add_tag_prompt = $("#addTagPromptTemplate").html();
            $(this.el).html(add_tag_prompt);
        },
        renderTag: function (item) {
            var tagView = new this.view_class({
                model: item
            });
            $(this.el).append(tagView.render().el);
        },
        refresh: function(){
            this.collection.fetch({async:false});
            $(this.el).empty();
            this.render_dash();
        }
    });

    var TweetView = Backbone.View.extend({
        tagName: "div",
        className: "tweets",
        events: {
        },
        initialize: function(){
            _.bindAll(this, 'render'); // every function that uses 'this' as the current object should be in here
            this.model.bind('change', this.render);
            this.model.bind('remove', this.unrender);
        },
        get_model_json: function(){
            var model_json = this.model.toJSON();
            model_json.created_at = model_json.created_at.split("T")[0];
            return model_json;
        },
        render: function () {
            var tmpl = _.template($("#tweetTemplate").html());
            var model_json = this.get_model_json();
            var model_html = tmpl(model_json);

            $(this.el).html(model_html);
            return this;
        },
        destroy: function() {
            this.model.trigger('destroy', this.model, this.model.collection, {});
        },
        remove_el: function(){
            $(this.el).remove();
        }
    });

    var TweetsView = Backbone.View.extend({
        el: $("#tweets"),
        collection_class : Tweets,
        view_class: TweetView,
        events: {
        },
        initialize: function () {
            _.bindAll(this, 'render', 'renderTweet', 'change_panel_height');
            this.collection = new this.collection_class();
            this.collection.fetch({async:false});
            this.render();
        },
        render: function () {
            var that = this;
            _.each(this.collection.models, function (item) {
                that.renderTweet(item);
            }, this);
            var that = this;
        },
        renderTweet: function (item) {
            var tweetView = new this.view_class({
                model: item
            });
            $(this.el).append(tweetView.render().el);
        }
    });

    window.TweetsView = TweetsView;
    window.TweetView = TweetView;
    window.TagView = TagView;
    window.TagsView = TagsView;
    window.Tag = Tag;
    window.TagSidebarView = TagSidebarView;
    window.TagsSidebarView = TagsSidebarView;
});
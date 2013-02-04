# -*- encoding: UTF-8 -*-
import cherrypy, os, gtk, webkit, threading, sys, signal, yaml, re, json
from cherrypy import HTTPError, expose, request, response
from git import *
from environment import env
from utils import *

repo = None
config = None

class Gui(object):
    @expose
    def commits(self, **data):
        global repo
        tmpl = env.get_template('_commits.html')
        try:
            skip = data['skip']
        except:
            skip = 0
        return tmpl.render(repo=repo, skip=skip, STATIC_URL='/static/')
    @expose
    def status(self):
        global repo
        tmpl = env.get_template('_status.html')
        return tmpl.render(repo=repo,STATIC_URL='/static/')
    @expose
    def details(self):
        global repo
        tmpl = env.get_template('_details.html')
        return tmpl.render(repo=repo,STATIC_URL='/static/')

class Handler(object):
    @expose
    def diff(self, **data):
        global repo
        try:
            commit = data['commit']
        except:
            commit = None
        if commit:
            diff = repo.git.diff(commit+"^",commit,"--",data['path'])
        else:
            if data['status'] == 'unstage':
                if data['mode'] == 'modified':
                    diff = repo.git.diff(data['path'])
                elif data['mode'] == 'created':
                    #diff = repo.git.execute(["git","diff","--no-index","/dev/null",data['path']])
                    #diff = repo.git.diff("--no-index","/dev/null",data['path'])
                    diff = "to implement..."
                else:
                    diff = "to implement..."
            else:
                if data['mode'] == 'deleted':
                    diff = "to implement..."
                else:
                    diff = repo.git.diff("--cached", data['path'])
        output = '<div class="diff-details">'
        for number, line in enumerate(diff.split('\n')):
            line = line.replace('<','&lt;').replace('>','&gt;')
            if number in [0,1]:
                output += '<span class="orange">'+line+'</span>'
            elif re.search("^\+", line):
                output += '<span class="green">'+line+'</span>'
            elif re.search("^-", line):
                output += '<span class="red">'+line+'</span>'
            elif re.search("^@", line):
                output += '<span class="blue">'+line+'</span>'
            else:
                output += '<span>'+line+'</span>'
        return output+"</div>"
    
    @expose
    def pull(self, **data):
        global repo
        remote = data['remote']
        branch = data['branch']
        try:
            return repo.git.pull(remote,branch)
        except Exception as inst:
            print 'Exception'
            return inst.__str__()

    @expose
    def push(self, **data):
        global repo
        remote = data['remote']
        branch = data['branch']
        try:
            output = repo.git.push(remote,branch)
            return "Ok" if output == "" else output
        except Exception as inst:
            print 'Exception'
            return inst.__str__()
    @expose
    def checkout(self, **data):
        global repo
        try:
            branch = data['branch']
        except:
            branch = None
            path = data['path']
            state = data['state']
        try:
            if branch:
                repo.git.execute(["git","checkout",branch])
                return "Ok"
            if state == "created":
                output = repo.git.clean("-f",path)
            else:
                output = repo.git.execute(["git","checkout","--",path])
            return "Ok"
        except Exception as inst:
            print 'Exception'
            return inst.__str__()
    @expose
    def create_branch(self, **data):
        global repo
        name = data['name']
        try:
            repo.git.execute(["git","branch",name])
            return "Ok"
        except Exception as inst:
            print 'Exception'
            return inst.__str__()
    @expose
    def diff_stat(self, **data):
        global repo
        commit = find_commit(data['commit'],repo)
        if commit is not None:
            output = "<ul class='commit-details' data-commit='"+commit.hexsha+"'>"
            for file in commit.stats.files:
                output += "<li><div><a href='#'  data-context-menu='file_menu'>"+file+"</a></div>"
                output += "<div><div class='deletions' style='width:"+str(commit.stats.files[file]['deletions'])+"px'>&nbsp;</div>"
                output += "<div class='insertions' style='width:"+str(commit.stats.files[file]['insertions'])+"px'>&nbsp;</div></div>"
                output += "<div>"+str(commit.stats.files[file]['lines'])+"</div></li>"
            output += "</ul>"
            return output
        return HTTPError(status=500, message=None)

    @expose
    def stage(self, **data):
        global repo
        path = data['path']
        if path is not None:
            status = get_status_stage(repo, path)
            if (status == 'deleted'):
                repo.git.rm(path)
            else:
                repo.git.add(path)
            return "OK"
        return HTTPError(status=500, message=None)

    @expose
    def unstage(self, **data):
        global repo
        path = data['path']
        if path is not None:
            try:
                #TODO: Fix: Always return 1...
                repo.git.reset('HEAD', path)
            except:
                pass
            return "OK"
        return HTTPError(status=500, message=None)

    @expose
    def commit(self, **data):
        global repo
        message = data['message']
        repo.git.commit(m=message)
        return "OK"
    
    @expose
    def get_heads_with_commit(self, **data):
        global repo
        output = []
        for remote in repo.remotes:
            for ref in remote.refs:
                output.append([ref.__str__(), ref.commit.hexsha])
        for branch in repo.branches:
            output.append([branch.__str__(), branch.commit.hexsha])
        return json.dumps(output)

    @expose
    def get_branches_in_remote(self, **data):
        global repo
        remote = find_remote(data['remote'],repo)
        if remote:
            return json.dumps([x.__str__() for x in remote.refs])
        return json.dumps([])

    @expose
    def merge(self, **data):
        global repo
        global config
        try:
            mergetool = config['mergetool']
            import os
            print "cd "+repo.working_dir+"; git mergetool -t "+mergetool
            return str(os.popen("cd "+repo.working_dir+"; git mergetool -t "+mergetool).read())
        except:
            return HTTPError(status=500, message='Error trying to open the mergetool...')

    @expose
    def open(self, **data):
        global config
        global repo
        try:
            path = data['path']
            for r in config['repositories']:
                if r['path'] == path:
                    r['active'] = True
                else:
                    r['active'] = False
            repo = Repo(path)
        except:
            return HTTPError(status=400, message='bad request')
        return "Ok"

class GtkWindow(threading.Thread):
    def __init__(self, lock):
        threading.Thread.__init__(self)
        self.lock = lock
        self._stop = threading.Event()
        self.window = gtk.Window()

    def run(self):
        self.lock.acquire()
        bro = webkit.WebView()
        bro.open("http://127.0.0.1:8080/")
        self.window.add(bro)
        self.window.show_all()
        
        self.window.connect("destroy", terminate_gitj_sig)

        gtk.main()
        self.lock.release()

    def stop(self):
        print "STOP GTK"
        self.window.destroy()
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

class Server(threading.Thread):
    def __init__(self, lock):
        threading.Thread.__init__(self)
        self.lock = lock
        self._stop = threading.Event()

    def run(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        conf = {'/static': {'tools.staticdir.on': True, 'tools.staticdir.dir': os.path.join(current_dir, 'static')}}

        cherrypy.tree.mount(Main(), '/', config=conf)
        cherrypy.engine.start()
        self.lock.release()

    def stop(self):
        print "STOP SERVER"
        cherrypy.engine.stop()
        self._stop.set()

    def stopped(self):
        return self._stop.isSet()

class Main(object):
    git = Handler()
    gui = Gui()
    @expose
    def index(self):
        global repo
        global config
        tmpl = env.get_template('base.html')
        try:
            return tmpl.render(repo=repo,config=config,STATIC_URL='/static/')
        except Exception, e:
            return env.get_template('error.html').render(exception=e)

    @expose
    def exit(self):
        terminate_gitj()

def only_server():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    conf = {'/static': {'tools.staticdir.on': True, 'tools.staticdir.dir': os.path.join(current_dir, 'static')}}
    cherrypy.quickstart(Main(), '/', config=conf)

def terminate_gitj_sig(signum, func=None):
    terminate_gitj()

def terminate_gitj():
    global server_thread
    global window_thread
    window_thread.stop()
    server_thread.stop()
    exit()

if __name__ == '__main__':
    try:
        f = open('config.yaml')
        config = yaml.load(f)
    except:
       print "config.yaml not found"
       exit()
    f.close()

    for r in config['repositories']:
        r['active'] = r['default']
        if r['active']:
            try:
                repo = Repo(r['path'])
            except:
                print 'Error try open repository %s repository'%r['path']  
    if not repo:
        repo = Repo(config['repositories'][0]['path'])

    if (len(sys.argv)>1 and sys.argv[1] == "server"):
        only_server()
    else:
        lock = threading.Lock()
        lock.acquire()
        server_thread = Server(lock)
        server_thread.start()
        server_thread.join()
        window_thread = GtkWindow(lock)
        window_thread.start()
        window_thread.join()

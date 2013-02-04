import time, re, md5, datetime
from jinja2 import Environment, FileSystemLoader

#TODO: remove absolute url
env = Environment(loader=FileSystemLoader('/home/mauricio/Dropbox/Proyectos/cherrygit/static/templates'))
margin=1

def to_node(commit):
    global margin
    children = []
    #import pdb; pdb.set_trace()
    for c in commit.parents:
        children.append({'target':str(c)}) 
    output = "<div class='point' style='margin-left:"+str(margin)+"px' id='"+str(commit)+"' data-targets=\""+str(children)+"\"></div>"
    return output

def smartstr(text):
    try:
        return text.encode('ascii','ignore')
    except:
        return "Error: Failed to decode message"

def diff_time(date):
    return time.asctime(time.gmtime(date))

def diff_time_human(date):
    timeDiff = datetime.datetime.now() -  datetime.datetime.fromtimestamp(date)
    days = timeDiff.days
    hours = timeDiff.seconds/3600
    minutes = timeDiff.seconds%3600/60
    seconds = timeDiff.seconds%3600%60
    
    str = ""
    tStr = ""
    if days > 0:
        if days == 1:   tStr = "day ago"
        else:           tStr = "days ago"
        str = str + "%s %s" %(days, tStr)
        return str
    elif hours > 0:
        if hours == 1:  tStr = "hour ago"
        else:           tStr = "hours ago"
        str = str + "%s %s" %(hours, tStr)
        return str
    elif minutes > 0:
        if minutes == 1:tStr = "min ago"
        else:           tStr = "mins ago"           
        str = str + "%s %s" %(minutes, tStr)
        return str
    elif seconds > 0:
        if seconds == 1:tStr = "sec ago"
        else:           tStr = "secs ago"
        str = str + "%s %s" %(seconds, tStr)
        return str
    else:
        return "Just now"

def get_username(repo):
    try:
        return repo.config_reader().get_value('user','name')
    except:
        return 'Unknown'

def get_email_hash(commit):
    return md5.md5(commit.author.email.lower()).hexdigest()

def get_foldername(patch):
    return re.sub('/.*/', '', patch).title()
    
def get_unstaged(repo):
    return [('deleted' if diff.deleted_file else 'modified',diff.a_blob.path) for diff in repo.index.diff(None)]+[('created',diff) for diff in repo.untracked_files]

def get_staged(repo):
    return [('deleted' if diff.deleted_file else ('created' if diff.new_file else 'modified'),diff.a_blob.path if diff.a_blob else diff.b_blob.path) for diff in repo.index.diff(None, staged=True)]

def get_unsync(repo):
    remote_repo = 'origin' if 'origin' in [str(x) for x in repo.remotes] else str(repo.remotes[0])
    default_remote_repo = remote_repo+'/'+str(repo.active_branch)+'..'
    data = repo.git.log(default_remote_repo,'--pretty=format:%H||%an||%at||%s').split('\n')
    commits = []
    for commit in data:
        if commit:
            tmp = commit.split("||")
            commits.append({
            'hexsha':tmp[0],
            'author':tmp[1],
            'date':float(tmp[2]),
            'summary':tmp[3]
        })
    
    return commits;

def notpushed(commits):
    output = []
    for commit in commits:
        if len(output)<5:
            output.append(commit)
        else:
            break
    return output

def length(array):
    return len(array)

env.filters['len'] = length
env.filters['notpushed'] = notpushed
env.filters['smartstr'] = smartstr
env.filters['to_node'] = to_node
env.filters['diff_time_human'] = diff_time_human
env.filters['diff_time'] = diff_time
env.filters['get_username'] = get_username
env.filters['get_email_hash'] = get_email_hash
env.filters['get_staged'] = get_staged
env.filters['get_unstaged'] = get_unstaged
env.filters['get_foldername'] = get_foldername
env.filters['get_unsync'] = get_unsync
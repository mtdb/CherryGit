def find_commit(hexsha,repo):
    if hexsha is None:
        return None
    for commit in repo.iter_commits():
        if (commit.hexsha == hexsha):
            return commit
    return None

def find_remote(name,repo):
    for remote in repo.remotes:
        if remote.__str__() == name:
            return remote
    return None

def get_status_stage(repo, p):
    for path in repo.untracked_files:
        if path == p:
            return 'created'
    for diff in repo.index.diff(None):
        if p == diff.a_blob.path:
            if diff.deleted_file:
                return 'deleted'
            else:
                return 'modified'
    return 'undefined'

#def get_status_unstage(repo, p):
#    for diff in repo.index.diff(None, staged=True):
#        path = diff.a_blob.path if diff.a_blob else diff.b_blob.path
#        if p == path:
#            return 'deleted' if diff.deleted_file else ('created' if diff.new_file else 'modified')

FROM python:alpine@sha256:2659ee0e84fab5bd62a4d9cbe5b6750285e79d6d6ec00d8e128352dad956f096 as builder

WORKDIR /app

RUN pip install --no-cache-dir \
	ansible \
	ssh

ADD ansible-galaxy-requirements.yaml ./

RUN ansible-galaxy role install -r ansible-galaxy-requirements.yaml

ENTRYPOINT [ "ansible-playbook", "-i", "ansible-inventory.yml" ]
CMD [ "ansible-playbook.yml" ]

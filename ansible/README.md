# Distributed Press Ansible Scripts

These scripts can help you deploy Distributed Press on your own VPS via SSH and [Ansible](https://www.ansible.com/)

## Developing / Running

This example will install distributed.press on `dp.chanterelle.xyz` listening on `http://localhost:3932/`.

You can edit `inventory.yml` to specify your own domain to run the scripts on as well as any variables you wish to set.

Dependencies:

- Python 3
- Ansible
- `ansible-galaxy install -r ./requirements.yml`

```
# execute the Ansible playbook with user defined variables
ansible-playbook distributed_press.yml -i inventory.yml
```

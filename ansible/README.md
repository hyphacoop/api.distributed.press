# Distributed Press Ansible Scripts

These scripts can help you deploy Distributed Press on your own VPS via SSH and [Ansible](https://www.ansible.com/)

## Developing / Running

The default playbook/ansible will deploy your distributed.press instance to `example.com` and set up all the 0

You can edit `inventory.yml` to specify your own domain to run the scripts on as well as any variables you wish to set.

Specifically, you *must* specify the `distributed_press_domain` do be your server, and your `distributed_press_letsencrypt_email` for registering the HTTPS certificate.

You *may* specify a list of domains in `distributed_press_served_sites` which specifies which domains you'd like to serve over HTTPS in addition to the p2p protocols.

Note that after you deploy your server you will need to point `_dnslink` subdomains to your DP instance via `NS` records. E.g. `NS _dnslink.example.com example.com`.

Dependencies:

- Python 3
- Ansible
- `ansible-galaxy install -r ./requirements.yml`

```yaml
---
all:
  # Set custom variables here, like custom ports for listening
  vars:
    distributed_press_domain: "example.com"
    distributed_press_letsencrypt_email: "example@example.com"
    distributed_press_served_sites: []
  children:
    distributed_press:
      hosts:
        example.com:
          ansible_user: root
```

```
# execute the Ansible playbook with user defined variables
ansible-playbook distributed_press.yml -i inventory.yml

# execute only the 'cron' related tasks of the Ansible playbook locally
sudo ansible-playbook distributed_press.yml -i local_deploy.yml --tags cron
```

## Debugging Staging

```bash
# ssh into staging
ssh root@dp.chanterelle.xyz

# change to press user
su press
cd ~/api.distributed.press

# status and logs
systemctl status distributed.press
journalctl -fu distributed.press
```

## Social Inbox

You can deploy an instance of the [Distributed Press Social Inbox](https://github.com/hyphacoop/social.distributed.press) along side the press by toggling the `social_inbox_enabled` flag.

```yaml
---
all:
  vars:
    social_inbox_enabled: true
    social_inbox_domain: "social.example.com"
    social_inbox_admins:
      - "@username@yourdomain.com"
```

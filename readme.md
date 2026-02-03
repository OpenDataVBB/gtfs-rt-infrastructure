# VBB GTFS Realtime feed – Ansible setup

This repo **configures the machines that the [VBB GTFS Realtime (GTFS-RT) feed](https://github.com/OpenDataVBB/gtfs-rt-feed) runs on** using [Ansible](https://docs.ansible.com/ansible/latest/index.html).

> [!TIP]
> If you're just looking for VBB's publicly deployed GTFS-RT feed:
> - [actual GTFS-RT feed](https://production.gtfsrt.vbb.de) ([staging](https://staging.gtfsrt.vbb.de))
> - [parsed in `gtfs-rt-inspector`](https://public-transport.github.io/gtfs-rt-inspector/?feedUrl=https%3A%2F%2Fproduction.gtfsrt.vbb.de%2Fdata&view=inspector) ([staging](https://public-transport.github.io/gtfs-rt-inspector/?feedUrl=https%3A%2F%2Fstaging.gtfsrt.vbb.de%2Fdata&view=inspector))

```mermaid
flowchart TB
    vdv_453_api(VBB VDV-453 API):::external
    style vdv_453_api fill:#ffd9c2,stroke:#ff8e62
    consumers(consumers):::external
    style consumers fill:#ffd9c2,stroke:#ff8e62
    subgraph nats[NATS JetStream]
        direction TB
        nats_ref_aus_sollfahrt["`*REF_AUS_SOLLFAHRT_2* stream`"]:::stream
        nats_aus_istfahrt["`*AUS_ISTFAHRT_2* stream`"]:::stream
        nats_gtfs_rt["`*GTFS_RT_2* stream`"]:::stream
        classDef stream fill:#ffffde,stroke:#aaaa33
    end
    subgraph services[ ]
        vdv_453_nats_adapter(OpenDataVBB/vdv-453-nats-adapter)
        gtfs_rt_feed(OpenDataVBB/gtfs-rt-feed)
        nats_consuming_gtfs_rt_server(OpenDataVBB/nats-consuming-gtfs-rt-server)
    end
    style services fill:none,stroke:none

    vdv_453_api-- VDV-453/-454 data -->vdv_453_nats_adapter
    vdv_453_nats_adapter-- "`VDV-453 *REF-AUS* *SollFahrt* messages`" -->nats_ref_aus_sollfahrt
    vdv_453_nats_adapter-- "`VDV-454 *AUS* *IstFahrt* messages`" -->nats_aus_istfahrt
    nats_ref_aus_sollfahrt-- "`VDV-453 *REF-AUS* *SollFahrt* messages`" -->gtfs_rt_feed
    nats_aus_istfahrt-- "`VDV-454 *AUS* *IstFahrt* messages`" -->gtfs_rt_feed
    gtfs_rt_feed-- "`GTFS-RT messages`" -->nats_gtfs_rt
    nats_gtfs_rt-- "`GTFS-RT messages`" -->nats_consuming_gtfs_rt_server
    nats_consuming_gtfs_rt_server-- combined GTFS-RT feed -->consumers
```

> [!NOTE]
> The password required to decrypt the [Ansible-Vault](https://docs.ansible.com/ansible/10/cli/ansible-vault.html)-encrypted secrets in this repository must be in a plain text file at `~/.vault-passwords/vbb-gtfs-rt-infrastructure.private`.

## VDV-453 proxy machines

> [!NOTE]
> Ansible group: `vdv_453_proxy`

These two (staging & production) machines will act as "proxies" (in a logical sense, not in a technical sense) between VBB's VDV-453 API and the machines converting the data to GTFS-RT.

They are VPSes hosted at [Planetary Networks](https://www.planetary-networks.de). They can be administered using their [management UI](https://console.planetary-networks.de:8800/).

## VDV-453 -> GTFS-RT conversion machines

> [!NOTE]
> Ansible group: `gtfs_rt_converter`

These machines convert VDV-453/VDV-454 data (sent by the respective `vdv_453_proxy` machine, see above), convert it into the GTFS-RT format, and serve the GTFS-RT feeds via HTTP.

They are connected to their respective VDV-453/VDV-454 proxy machine via a [Wireguard](https://www.wireguard.com) tunnel, letting them communicate via a [NATS message queue](https://nats.io).

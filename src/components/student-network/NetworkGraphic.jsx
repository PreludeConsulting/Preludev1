const mentorTeamImage = `${import.meta.env.BASE_URL}media/mentor-team-cards.png`;

export default function NetworkGraphic() {
  return (
    <div className="sn-network-graphic" aria-hidden="true">
      <div className="sn-network-graphic__stage">
        <img
          src={mentorTeamImage}
          alt=""
          className="sn-network-graphic__image"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

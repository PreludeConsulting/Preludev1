const mentorTeamImage = `${import.meta.env.BASE_URL}media/mentor-team-cards.png?v=ryan-cain`;

export default function NetworkGraphic() {
  return (
    <div className="sn-network-graphic" aria-hidden="true">
      <img
        src={mentorTeamImage}
        alt=""
        className="sn-network-graphic__image"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

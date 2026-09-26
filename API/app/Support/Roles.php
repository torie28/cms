<?php

namespace App\Support;

class Roles
{
    public const ADMIN = 'admin';
    public const SECRETARY = 'secretary';
    public const TREASURER = 'treasurer';
    public const KANDA_LEADER = 'kanda_leader';
    public const JUMUIYA_LEADER = 'jumuiya_leader';
    public const MEMBER = 'member';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::ADMIN,
            self::SECRETARY,
            self::TREASURER,
            self::KANDA_LEADER,
            self::JUMUIYA_LEADER,
            self::MEMBER,
        ];
    }
}
